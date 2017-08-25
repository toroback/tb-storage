var path = require('path');
  

let App;      // reference to toroback
let log;      // logger (toroback's child)
var _defaultService = 'local';

let servicesLocation = "./services"

let storageReferences = {};

class Storage{

  constructor(service, rootPath, credentials){
    // this.rootPath = rootPath;
    // this.credentials = credentials;
    this.service = service || _defaultService;
    log.trace("servicio %s", this.service);
    switch(this.service){
      case 'local':
        var A2sLocal = require(servicesLocation+"/storage-local.js");
        this.fsObject = new A2sLocal(App, rootPath);
        break;
      case 'gcloud':
        var a2sGcloud = require(servicesLocation+"/storage-gcloud.js");
        this.fsObject = new a2sGcloud(App, rootPath, credentials || App.storageOptions.gcloud);
        break;
      case 'aws':
        var a2sAws = require(servicesLocation+"/storage-aws.js");
        this.fsObject = new a2sAws(App, rootPath, credentials || App.storageOptions.aws);
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
      path:      path.normalize(reference.pathPrefix +"/"+ referenceObject.path)
    };
    return serviceObject;
  }


  static toReferenceObject(serviceObject) {
    // let reference = storageReferences[serviceObject.reference];
    let referenceObject = null;
    let objectKeys = Object.keys(storageReferences);
    for (var i = 0; i < objectKeys.length; i++) {
      let refName = objectKeys[i];
    // for ( refName in storageReferences ) {
      let reference = storageReferences[refName];
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

  // static referenceFromService(arg){
  //   let foundRef;
  //   let objectKeys = Object.keys(storageReferences);
  //   for (var i = 0; i < objectKeys.length; i++) {
  //     let key = objectKeys[i];
  //     let ref = storageReferences[key];
  //     if(ref.service === arg.service && ref.container === arg.container && ref.pathPrefix === arg.pathPrefix){
  //       console.log("found");
  //       foundRef = key;
  //       break;
  //     }
  //   }
  //   return foundRef;
  // }

  // static toService(key){
  //   return storageReferences[key];
  // }

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

  getFsObject(service, rootPath,  credentials){
    // this.service = service || _defaultService
    // if(service && this.service != service){
    //   this.service = service;
    //   switch(this.service){
    //     case 'local':
    //       var A2sLocal = require(servicesLocation+"/storage-local.js");
    //       this.fsObject = new A2sLocal(App, rootPath);
    //       break;
    //     case 'gcloud':
    //       var a2sGcloud = require(servicesLocation+"/storage-gcloud.js");
    //       this.fsObject = new a2sGcloud(App, rootPath, credentials || App.storageOptions.gcloud);
    //       break;
    //     case 'aws':
    //       var a2sAws = require(servicesLocation+"/storage-aws.js");
    //       this.fsObject = new a2sAws(App, rootPath, credentials || App.storageOptions.aws);
    //       break;
    //   }
    // }
    return this.fsObject;
  }
  
  /**
   * Permite crear un contenedor de archivos
   * @function createContainer
   * @param {arg} payload - Objeto payload que recibe el metodo
   * @param {Object} payload.container
   * @param {string} payload.container._id - nombre del contenedor a crear
  */
  createContainer(arg) {
    return new Promise((resolve, reject) => {
      // arg = processArgs(arg);
      this.getFsObject(arg.service).createContainer(arg)
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
      this.getFsObject(arg.service).getFileInfo(arg)
        .then(doc => {
          resolve({file:doc});
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
      this.getFsObject(arg.service).getFiles(arg)
        .then(docs => {
          resolve({files:docs});
        })
        .catch(reject); 
    });
  };

  /**
   * Permite obtener un archivo del servidor
   * @function downloadFile
   * @param {arg} payload - Objeto payload que recibe el metodo
   * @param {string} payload.container - nombre del contenedor donde se encuentra dicho archivo (opcional)
   * @param {string} payload.file - nombre del archivo que se desea descargar donde se 
   * @param {Object} payload.res - objecto donde se devuelve el fichero (tipo de objeto <stream.Writable>)
  */
  downloadFile(arg){
    return new Promise((resolve, reject) => {
      // arg = processArgs(arg);
      this.getFsObject(arg.service).getFile(arg)
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
      this.getFsObject(arg.service).getContainerInfo(arg)
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
      // arg = processArgs(arg);
      this.getFsObject(arg.service).getContainers(arg)
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
   * @param {Object} payload.file - Objeto que representa al archivo que deseamos guardar
   * @param {string} payload.file.path - path donde se encuentra de forma temporal el archivo
   * @param {String} payload.url - Para almacenar un archivo alojado en una url, pasamos este campo en lugar de file.
  */
  uploadFile(arg){
    return new Promise((resolve, reject) => {
      // arg = processArgs(arg);
      
      this.getFsObject(arg.service).uploadFile(arg)
        .then(doc => {
          let obj = {
             
          }
          if(arg.reference){
            obj = Storage.toReferenceObject({service: this.service, container: arg.container, path: arg.path});
            // obj.reference = arg.reference;
          }else{
            obj.path = arg.path;
            obj.service = this.service,
            obj.container =  arg.container,
            obj.public = arg.public || false, //por el momento en local siempre es true (arg.public ? true: false),
            obj.url = doc.path
          } 
          resolve({file:obj});
        })
        .catch(reject); 
    });
  };

  /**
   * Elimina un contenedor
   * @function deleteContainer
   * @param {arg} payload - Objeto payload que recibe el metodo
   * @param {string} payload.container - nombre del contenedor que deseamos eliminar
   * @param  {Object} arg.force  Flag para indicar si la eliminación es forzada
  */
  deleteContainer(arg){
    return new Promise((resolve, reject) => {
      // arg = processArgs(arg);
      this.getFsObject(arg.service).deleteContainer(arg)
        .then(doc => {
          resolve({container:doc});
        })
        .catch(reject); 
    });
  };

  /**
   * Elimina un archivo
   * @function deleteFile
   * @param {ctx} payload - Objeto payload que recibe el metodo
   * @param {string} payload.container - nombre del contenedor donde se encuentra el archivo
   * @param {string} payload.file - nombre del archivo a eliminar
  */
  deleteFile(arg){
    return new Promise((resolve, reject) => {
      // arg = processArgs(arg);
      this.getFsObject(arg.service).deleteFile(arg)
        .then(doc => {
          resolve({file:doc});
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
      // arg = processArgs(arg);
      this.getFsObject(arg.service).deleteFiles(arg)
        .then(doc => {
          resolve({file:doc});
        })
        .catch(reject); 
    });
  };

}

function newContainer(name, path, stat){
  return {_id:name, path:path, size:stat.size};
}

// function processArgs(arg){
//   let newArgs = Object.assign({},arg);
//   if(newArgs){
//     if((!newArgs.service || !newArgs.container) && newArgs.reference){
//       console.log("processing reference");
//       delete newArgs.service;
//       delete newArgs.container;
//       console.log("storageReferences", storageReferences);
//       let data = storageReferences[newArgs.reference];
//       if(data){
//         newArgs.service = data.service;
//         newArgs.container = data.container;
//         newArgs.pathPrefix = data.pathPrefix;
//       }
//     }else{
//         console.log("processing service");
//       delete newArgs.reference;
//     }
//   }
//   console.log("processed args", newArgs);
//   return newArgs;
// }



module.exports = Storage;
