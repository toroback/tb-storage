
let App;      // reference to toroback
let log;      // logger (toroback's child)
var _defaultService = 'local';

let servicesLocation = "./services"

class Storage{

  constructor(service, rootPath, credentials){
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


  // multimedia tb module setup. Must be called before any instance creation. 
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


  /**
   * Metodo que permite llamar a cualquier otro metodo del modulo comprobando con aterioridad si el usuario tiene permisos para acceder a este.
   * @function do
   * @param {ctx} CTX Contexto donde se indicará el resource y el method a ejecutar
  */
  do(ctx){
    return new Promise((resolve,reject) => {
      // var clientId = ctx.session.user._id;
      log.debug(ctx.file);
      log.debug(ctx.container);
      
      App.acl.checkActions(ctx, ctx.model, ctx.method)
        .then(() => {
          //Hace la llamada al método correspondiente
          return this[ctx.method](ctx.payload); 
        })
        .then(resolve)
        .catch(reject);
      
    });
  };

  
  /**
   * Permite crear un contenedor de archivos
   * @function createContainer
   * @param {arg} payload - Objeto payload que recibe el metodo
   * @param {Object} payload.container
   * @param {string} payload.container._id - nombre del contenedor a crear
  */
  createContainer(arg) {
    return new Promise((resolve, reject) => {
      this.fsObject.createContainer(arg)
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
      this.fsObject.getFileInfo(arg)
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
      this.fsObject.getFiles(arg)
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
      this.fsObject.getFile(arg)
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
      this.fsObject.getContainerInfo(arg)
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
      this.fsObject.getContainers(arg)
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
      this.fsObject.uploadFile(arg)
        .then(doc => {
          resolve({file:doc});
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
      this.fsObject.deleteContainer(arg)
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
      this.fsObject.deleteFile(arg)
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
      this.fsObject.deleteFiles(arg)
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


module.exports = Storage;
