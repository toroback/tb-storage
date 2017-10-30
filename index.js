var path = require('path');
  

let App;      // reference to toroback
let log;      // logger (toroback's child)
var _defaultService = 'local';

let servicesLocation = "./services"

let storageReferences = {};

class Storage{

  constructor(service, options){
    this.service = service || _defaultService;
    log.trace("servicio %s", this.service);
    switch(this.service){
      case 'local':
        var A2sLocal = require(servicesLocation+"/storage-local.js");
        this.fsObject = new A2sLocal(App, options);
        break;
      case 'gcloud':
        var a2sGcloud = require(servicesLocation+"/storage-gcloud.js");
        this.fsObject = new a2sGcloud(App, options || App.storageOptions.gcloud);
        break;
      case 'aws':
        var a2sAws = require(servicesLocation+"/storage-aws.js");
        this.fsObject = new a2sAws(App, options || App.storageOptions.aws);
        break;
    }
  }


  // storage tb module setup. Must be called before any instance creation. 
  static setup(_app) {
    return new Promise( (resolve, reject) => {
      // set globals
      App = _app;
      log = _app.log.child({module:'storage'});
     
      log.info('Setup: Storage');
      // load routes
      require("./routes")(_app);
      resolve( );
    });
  }


  static setReferences(refs){
    console.log("Setting references", refs);
    storageReferences = refs || {};
  }

  static toServiceObject(referenceObject) {
    let reference = storageReferences[referenceObject.reference];
    let serviceObject = {
      service:   reference.service,
      container: reference.container,
      path:      path.join(reference.pathPrefix, referenceObject.path || "")
    };
    return serviceObject;
  }


  static toReferenceObject(serviceObject) {
    // let reference = storageReferences[serviceObject.reference];
    console.log("toReferenceObject",serviceObject);
    let referenceObject = null;
    let objectKeys = Object.keys(storageReferences);
    for (var i = 0; i < objectKeys.length; i++) {
      let refName = objectKeys[i];
    // for ( refName in storageReferences ) {
      let reference = storageReferences[refName];
      console.log("toReferenceObject ref",reference);
      if ( serviceObject.service == reference.service &&
           serviceObject.container == reference.container &&
           serviceObject.path.startsWith(reference.pathPrefix) )
      {
        referenceObject = {
          reference: refName,
          path: serviceObject.path.substring(reference.pathPrefix.length)
        }
        break;
      }
    }
    return referenceObject;
  }

  static getLocalPath(container, subPath){
    var A2sLocal = require(servicesLocation+"/storage-local.js");
    return A2sLocal.getLocalPath(App, container, subPath);
  }

  static genToken(service, minTime = 1800, credentials){  // minTime en segundos
    if (!App)
      throw new Error('getToken: setup() needs to be called first');

    return new Promise( (resolve, reject) => {
      if(!service){
        reject(App.err.badData('You must provide a service'));
      }else{
        if (service == 'gcloud') {
          var a2sGcloud = require(servicesLocation+"/storage-gcloud.js");
          a2sGcloud.genToken(App, credentials || App.storageOptions.gcloud, minTime)
            .then(resp =>{
              if(resp.expires_at){
                resp.expires_at = new Date(resp.expires_at);
              }
              resolve(resp);
            })
            .catch(reject);
        } else {
          reject(new Error('Service not available yet'));
        }
      }
    });
  }

  /**
   * Metodo que permite llamar a cualquier otro metodo del modulo comprobando con aterioridad si el usuario tiene permisos para acceder a este.
   * @function do
   * @param {ctx} CTX Contexto donde se indicará el resource y el method a ejecutar
  */
  do(ctx){
    return new Promise((resolve,reject) => {
      App.acl.checkActions(ctx, ctx.model, ctx.method)
        .then(() => {
          //Hace la llamada al método correspondiente
          return this[ctx.method](ctx.payload); 
        })
        .then(resolve)
        .catch(reject);
      
    });
  };

  getFsObject(){
    return this.fsObject;
  }
  
  /**
   * Permite crear un contenedor de archivos
   * @function createContainer
   * @param {arg} payload - Objeto payload que recibe el metodo
   * @param {string} payload.container - nombre del contenedor a crear
   * @param {string} payload.public - nombre del contenedor a crear
  */
  createContainer(arg) {
    return new Promise((resolve, reject) => {
      // arg = processArgs(arg);
      arg = normalizeArgs(this.service, arg);
      checkContainer(arg);
      this.getFsObject().createContainer(arg)
        .then(doc => {
          resolve({container:doc});
        })
        .catch(reject); 
    });
  };

  /**
   * Permite Obtener información sobre un archivo
   * @function getFileInfo
   * @param {arg} payload - Objeto payload que recibe el metodo
   * @param {string} payload.container - nombre del contenedor donde se encuentra dicho archivo
   * @param {string} payload.file - nombre del file
  */
  getFileInfo(arg){
    return new Promise((resolve, reject) => {
      // arg = processArgs(arg);
      arg = normalizeArgs(this.service, arg);
       checkContainer(arg);
      this.getFsObject().getFileInfo(arg)
        .then(doc => {
          let obj = createFileForResponse(this.service, arg, doc.path, doc.url, doc.public);
          resolve({file:obj});
        })
        .catch(reject); 
    });
  };

  /**
   * Obtiene todos los archivos de un contenedor
   * @function getFiles
   * @param {arg} payload - Objeto payload que recibe el metodo
   * @param {string} payload.container - nombre del contenedor donde se encuentra dicho archivo
   * @return {array} Devuelve un array con información sobre todos los archivos del contenedor
   <pre>
    {
      "files": [
        {
          "_id": "test/test1.jpg",
          "size": "2567",
          "path": "http://myhost.com/fs/mycontainer/test%2Ftest1.jpg"
        },
        {
          "_id": "test/test2.jpg",
          "size": "85825",
          "path": "http://myhost.com/fs/mycontainer/test%2Ftest2.jpg"
        }]
    }
   </pre>
  */
  getFiles(arg){
    return new Promise((resolve, reject) => {
      // arg = processArgs(arg);
      arg = normalizeArgs(this.service, arg);
      checkContainer(arg);
      this.getFsObject().getFiles(arg)
        .then(docs => {
          let objs = docs ? docs.map(doc => createFileForResponse(this.service, arg, doc.path, doc.url, doc.public)) : []
          resolve({files:objs});
        })
        .catch(reject); 
    });
  };

  /**
   * Permite obtener un archivo del servidor
   * @function downloadFile
   * @param {arg} payload - Objeto payload que recibe el metodo
   * @param {string} payload.container - nombre del contenedor donde se encuentra dicho archivo (opcional)
   * @param {string} payload.path - nombre del archivo que se desea descargar donde se 
   * @param {Object} payload.res - objecto donde se devuelve el fichero (tipo de objeto <stream.Writable>)
  */
  downloadFile(arg){
    return new Promise((resolve, reject) => {
      // arg = processArgs(arg);
      arg = normalizeArgs(this.service, arg);

      checkContainer(arg);
      this.getFsObject().getFile(arg)
        .then(docs => resolve())
        .catch(reject); 
    });
  };

  /**
   * Obtiene información de un contenedor
   * @function getContainerInfo
   * @param {arg} payload - Objeto payload que recibe el metodo
   * @param {string} payload.container - nombre del contenedor donde se encuentra dicho archivo
  */
  getContainerInfo(arg){
    return new Promise((resolve, reject) => {
      // arg = processArgs(arg);
      arg = normalizeArgs(this.service, arg);
      checkContainer(arg);
      this.getFsObject().getContainerInfo(arg)
        .then(doc => {
          resolve({container:doc});
        })
        .catch(reject); 
    });
  };

  /**
   * Obtiene todos los contenedores creados
   * @function getContainers
  */
  getContainers(arg){
    return new Promise((resolve, reject) => {
      arg = normalizeArgs(this.service, arg);

      this.getFsObject().getContainers(arg)
        .then(docs => {
          resolve({containers:docs});
        })
        .catch(reject); 
    });
  };

  /**
   * Permite almacenar un archivo en el contenedor indicado
   * @function uploadFile
   * @param {arg} payload - Objeto payload que recibe el metodo
   * @param {string} payload.container - nombre del contenedor sera guardado el archivo
   * @param {string} payload.path - nombre con el cual se guardará el archivo (formato test/test1/text.txt)
   * @param {File} payload.file - Objeto que representa al archivo que deseamos guardar
  */
  uploadFile(arg){
    return new Promise((resolve, reject) => {
      // arg = processArgs(arg);
      arg = normalizeArgs(this.service, arg);
      
      if(!arg.file)
        throw new Error("You must provide a file to upload");

       checkContainer(arg);

      if(!arg.path)
        throw new Error("You must provide a path");

      this.getFsObject().uploadFile(arg)
        .then(doc => {
          let obj = createFileForResponse(this.service, arg, doc.path, doc.url, doc.public);
          // let obj = {}
          // if(arg.reference){
          //   obj = Storage.toReferenceObject({service: this.service, container: arg.container, path: arg.path});
          // }else{
          //   obj.path = arg.path;
          //   obj.service = this.service,
          //   obj.container =  arg.container,
          //   obj.public = arg.public || false, //por el momento en local siempre es true (arg.public ? true: false),
          //   obj.url = doc.path
          // } 
          resolve({file:obj});
        })
        .catch(reject); 
      
    });
  };

  /**
   * Elimina un contenedor
   * @function deleteContainer
   * @param {arg} arg - Objeto payload que recibe el metodo
   * @param {string} arg.container - nombre del contenedor que deseamos eliminar
   * @param {Boolean} arg.force  Flag para indicar si la eliminación es forzada
  */
  deleteContainer(arg){
    return new Promise((resolve, reject) => {
      arg = normalizeArgs(this.service, arg);

       checkContainer(arg);

      this.getFsObject().deleteContainer(arg)
        .then(doc => {
          resolve({container:doc});
        })
        .catch(reject); 
    });
  };

  /**
   * Elimina un archivo
   * @function deleteFile
   * @param {ctx} arg - Objeto payload que recibe el metodo
   * @param {string} arg.container - Nombre del contenedor donde se encuentra el archivo
   * @param {string} arg.path - Path del archivo a eliminar
  */
  deleteFile(arg){
    return new Promise((resolve, reject) => {
      arg = normalizeArgs(this.service, arg);
      
      checkContainer(arg);

      this.getFsObject().deleteFile(arg)
        .then(doc => {
          let obj = createFileForResponse(this.service, arg, doc.path, undefined, doc.public); //cuando se elimina no devuelvo la url
          resolve({file:obj});
        })
        .catch(reject); 
    });
  };

  /**
   * Elimina todos los archivos de un path específico 
   * @function deleteFiles
   * @param {arg} payload - Objeto payload que recibe el metodo
   * @param {string} payload.container - nombre del contenedor donde se encuentra el archivo
   * @param {string} payload.prefix - nombre del path a Eliminar
  */
  deleteFiles(arg){
    return new Promise((resolve, reject) => {
      arg = normalizeArgs(arg);
      // arg = processArgs(arg);
      checkContainer(arg);
      this.getFsObject().deleteFiles(arg)
        .then(docs => {
          let objs = docs ? docs.map(doc => createFileForResponse(this.service, arg, doc.path, doc.url, doc.public)) : []
          resolve({files:objs});
        })
        .catch(reject); 
    });
  };

  makeFilePublic(arg){
    return new Promise((resolve, reject) => {
      arg = normalizeArgs(this.service, arg);
      checkContainer(arg);
      this.getFsObject().makeFilePublic(arg)
        .then(doc => {
          let obj = createFileForResponse(this.service, arg, doc.path, doc.url, arg.public);
          resolve({file:obj});
        })
        .catch(reject); 
    });
  }

}

function newContainer(name, path, stat){
  return {_id:name, path:path, size:stat.size};
}

function createFileForResponse(service, reqArgs, path, url, public){
  let obj = {};
  if(reqArgs.reference){
    obj = Storage.toReferenceObject({service: service, container: reqArgs.container, path: path});
  }else{
    obj.path = path;
    obj.service = service,
    obj.container =  reqArgs.container,
    obj.public = public || false, //por el momento en local siempre es true (arg.public ? true: false),
    obj.url = url
  } 
  return obj;
}

/**
 * Funcion que normaliza los argumentos. 
 * @param  {[type]} arg [description]
 * @return {[type]}     [description]
 */
function normalizeArgs(service, arg){
  let newArgs = Object.assign({},arg);
  if(newArgs.container){
    if(service == "aws"){ //para amazon se pasa el contenedor a minuscula
      newArgs.container = newArgs.container.toLowerCase();
    }
  }

  if(newArgs.path && newArgs.path.startsWith("/")){
    newArgs.path = newArgs.path.substring(1);
  }
  return newArgs;
}

function checkContainer(arg){
  if(!arg.container)
    throw new Error(arg.reference ? "Cannot find container for reference" : "You must provide a container or a reference");
}
// function checkFileArgs(arg){
//   if(!arg.service || !arg.container){
//     let err;
//     if(arg.reference){
//       err = new Error("Cannot find service or container for reference");
//     }else{
//       err = new Error("You must provide a service and a container or a reference");
//     }
//     throw err;
//   }
// }



module.exports = Storage;
