/** 
 * @module tb-storage 
 * @description 
 * Modulo para almacenamiento.
 *
 * <p>Este módulo permite almacenar archivos (subir, bajar, obtener información, etc…) tanto en local como en algún servicio de almacenamiento externo de archivos como puede ser "Google Cloud". </p>
 * <p>
 * @see [Guía de uso]{@tutorial tb-storage} para más información.
 * @see [REST API]{@link module:tb-storage/routes} (API externo).
 * @see [Class API]{@link module:tb-storage.Storage} (API interno).
 * @see Repositorio en {@link https://github.com/toroback/tb-storage|GitHub}.
 * </p>
 * 
 */



var path = require('path');
let multer = require('multer');
var appDir = path.dirname(require.main.filename);

let App;      // reference to toroback
let log;      // logger (toroback's child)
var _defaultService = 'local';

let servicesLocation = "./services"

let storageReferences = {};

/**
 * Clase que representa un gestor de almacenamiento
 * @memberOf module:tb-storage
 */
class Storage{
  /**
   * Crea un gestor de almacenamiento para un servicio indicado
   * @param  {String} service                 Servicio para el que se va a crear el gestor (local, gcloud, aws)
   * @param  {Object} [options]               Objeto con las credenciales para el servicio. Por defecto se toman las credenciales definidas en el archivo config.json de "app"
   * @param  {String} options.projectId       (GCloud) ProjectId de GCloud
   * @param  {Object} options.keyFile         (GCloud) Objeto con información del keyFile de GCloud
   * @param  {String} options.keyFile.cert    Path relativo a la carpeta "cert" del proyecto con la ubicación del keyFile de GCloud
   * @param  {String} options.accessKeyId     (Amazon) Access key de Amazon
   * @param  {String} options.secretAccessKey (Amazon) Clave secreta de Amazon
   * @param  {String} [options.region]        (Amazon) Región de uso del servicio de Amazon 
   * @param  {String} [options.rootPath]      (Local) Path base explicito en el que almacenar los archivos en local. Sino, toma el valor por defecto
   */
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


  /**
   * Setup del módulo. Debe ser llamado antes de crear una instancia
   * @param {Object} _app Objeto App del servidor
   * @return {Promise} Una promesa
   */
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
   * Establece las referencias que representaran ubicaciones predefinidas
   * @param {Object} refs - Objeto cuyas claves son los nombres de las referencias y los valores la referencia que representa.
   */
  static setReferences(refs){
    console.log("Setting references", refs);
    storageReferences = refs || {};
  }

  /**
   * Convierte un objeto de una ubicacion basada en referencia en una ubicacion basada en servicio y contenedor 
   * 
   * @param  {Object} referenceObject            - Ubicación representada por referencia
   * @param  {String} referenceObject.reference  - Nombre de la referencia
   * @param  {String} [referenceObject.path]     - Path relativo a la referencia
   * @return {Object}                           Ubicación representada por servicio y contendor
   */
  static toServiceObject(referenceObject) {
    let reference = storageReferences[referenceObject.reference];
    if(!reference) throw App.err.notFound('Reference not found: ' + referenceObject.reference);// new Error("Reference not valid");

    let serviceObject = {
      service:   reference.service,
      container: reference.container,
      path:      path.join(reference.pathPrefix, referenceObject.path || "")
    };
    return serviceObject;
  }

  /**
   * Convierte un objeto de una ubicación basada en servicio y contenedor en una ubicación basada en referencia
   * 
   * @param  {Object} serviceObject           - Ubicación basada en servicio y contenedor
   * @param  {String} serviceObject.service   - Servicio en el que está ubicado
   * @param  {String} serviceObject.container - Contenedor de la ubicación
   * @param  {String} [serviceObject.path]    - Path relativo al contenedor
   * @return {Object}                         Ubicación representada por referencia
   */
  static toReferenceObject(serviceObject) {
    console.log("toReferenceObject",serviceObject);
    let referenceObject = null;
    let objectKeys = Object.keys(storageReferences);
    for (var i = 0; i < objectKeys.length; i++) {
      let refName = objectKeys[i];
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

  /**
   * Devuelve el path de un archivo almacenado en local
   * 
   * @param  {String} container - Nombre del contenedor en el que esta ubicado el archivo
   * @param  {String} subPath   - Path relativo al contenedor de la ubicación
   * @return {String}           El path del archivo
   */
  static getLocalPath(container, subPath){
    if (!App)
      throw new Error('getToken: setup() needs to be called first');

    var A2sLocal = require(servicesLocation+"/storage-local.js");
    return A2sLocal.getLocalPath(App, container, subPath);
  }

  /**
   * Genera un token de acceso para el servicio indicado. Actualmente sólo disponible para GCloud
   * 
   * @param  {String} service     Servicio para el que generar el token
   * @param  {Number} minTime     Duración requerida para el token. 
   * @param  {Object} credentials Objeto con las credenciales de acceso para el servicio.
   * @return {Promise<Object>}    Promesa con el objeto con la información del token
   */
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
   * Metodo que permite llamar a cualquier otro metodo del modulo comprobando con anterioridad si el usuario tiene permisos para acceder a este.
   * @param {ctx} CTX Contexto donde se indicará el resource y el method a ejecutar
   * @return {Promise<Object>} Promesa con el resultado del metodo llamado
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

  /**
   * Devuelve el objeto del servicio actual
   * @private
   * @return {Object} El objeto del servicio actual
   */
  getFsObject(){
    return this.fsObject;
  }
  
  /**
   * Crea un contenedor de archivos
   * @param {Object} arg           - Objeto payload que recibe el metodo
   * @param {String} arg.container - Nombre del contenedor a crear
   * @param {String} arg.public     - Indica si el contenedor será publico o no
   * 
   * @return {Promise<Object>} Promesa con la información del contenedor
  */
  createContainer(arg) {
    return new Promise((resolve, reject) => {
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
   * Obteniene información sobre un archivo
   * 
   * @param {Object} arg - Objeto Payload que recibe el metodo
   * @param {String} arg.container - Nombre del contenedor donde se encuentra dicho archivo
   * @param {String} arg.path - Nombre del archivo
   *
   * @return {Promise<Object>} Promesa con la información del archivo
  */
  getFileInfo(arg){
    return new Promise((resolve, reject) => {
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
   * Obtiene todos los archivos de una ubicación
   * 
   * @param {Object} arg           - Objeto payload que recibe el metodo
   * @param {String} arg.container - Nombre del contenedor donde se encuentra dicho archivo
   * @param {String} arg.path      - Path del que se quiere obtener la informacion
   * @return {Promise<Array>}     Devuelve una promesa al array con información sobre todos los archivos de la ubicacion indicada
  */
  getFiles(arg){
    return new Promise((resolve, reject) => {
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
   * 
   * @param {arg}    arg                Objeto payload que recibe el metodo
   * @param {string} arg.container      Nombre del contenedor donde se encuentra dicho archivo (opcional)
   * @param {string} arg.path           Nombre del archivo que se desea descargar
   * @param {Stream.Writable} arg.res   Flujo por donde se devuelve el fichero
   * @return {Promise} Una promesa
  */
  downloadFile(arg){
    return new Promise((resolve, reject) => {
      arg = normalizeArgs(this.service, arg);

      checkContainer(arg);
      this.getFsObject().getFile(arg)
        .then(docs => resolve())
        .catch(reject); 
    });
  };

  /**
   * Obtiene información de un contenedor
   * 
   * @param {Object} arg            Objeto payload que recibe el metodo
   * @param {string} arg.container  Nombre del contenedor
   * @return {Promise<Object>}      Promesa con la información del contenedor.    
  */
  getContainerInfo(arg){
    return new Promise((resolve, reject) => {
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
   * Obtiene todos los contenedores
   * @param {Object} [arg] Objeto con la información de los containers a cargar
   * @return {Promise<Array>}  Promesa con los contenedores cargados
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
   * 
   * @param {arg}     arg             - Objeto payload que recibe el metodo
   * @param {string}  arg.container   - nombre del contenedor donde será guardado el archivo
   * @param {string}  arg.path        - nombre con el cual se guardará el archivo (formato test/test1/text.txt)
   * @param {File}    arg.file        - Objeto que representa al archivo que deseamos guardar
   * @param {Boolean} arg.public      - Indica si el archivo será publico o no
   * @return {Promise<Object>}       Promesa con la información del archivo.    
  */
  uploadFile(arg){
    return new Promise((resolve, reject) => {
      arg = normalizeArgs(this.service, arg);
      
      if(!arg.file)
        throw new Error("You must provide a file to upload");

       checkContainer(arg);

      if(!arg.path)
        throw new Error("You must provide a path");

      this.getFsObject().uploadFile(arg)
        .then(doc => {
          let obj = createFileForResponse(this.service, arg, doc.path, doc.url, doc.public);
          resolve({file:obj});
        })
        .catch(reject); 
      
    });
  };

  /**
   * Elimina un contenedor
   * 
   * @param {Object} arg            - Objeto payload que recibe el metodo
   * @param {String} arg.container  - nombre del contenedor que deseamos eliminar
   * @param {Boolean} arg.force     - Flag para indicar si la eliminación es forzada
   * @return {Promise<Object>}       Promesa con la información del contenedor.    
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
   * 
   * @param {ctx} arg - Objeto payload que recibe el metodo
   * @param {string} arg.container - Nombre del contenedor donde se encuentra el archivo
   * @param {string} arg.path - Path del archivo a eliminar
   * @return {Promise<Object>}       Promesa con la información del archivo.    
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
   * 
   * @param {Object} arg              Objeto payload que recibe el metodo
   * @param {String} arg.container    Nombre del contenedor donde se encuentra el archivo
   * @param {String} arg.path         Nombre del path a Eliminar
   * @return {Promise<Object>}        Promesa con la información de los archivos eliminados.
  */
  deleteFiles(arg){
    return new Promise((resolve, reject) => {
      arg = normalizeArgs(arg);
      checkContainer(arg);
      this.getFsObject().deleteFiles(arg)
        .then(docs => {
          let objs = docs ? docs.map(doc => createFileForResponse(this.service, arg, doc.path, doc.url, doc.public)) : []
          resolve({files:objs});
        })
        .catch(reject); 
    });
  };

  /**
   * Cambia el estado de publico del archivo
   * @param  {Object} arg            Objeto con la informacion necesaria
   * @param  {String} arg.container  Nombre del contenedor del archivo
   * @param  {String} arg.path       Path del archivo
   * @param  {String} arg.public     Nuevo estado de público del archivo
   * @return {Promise<Object>}       Promesa con la información del archivo.    
  */
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
  };

  /**
   * Establece los metadatos  del archivo
   * @param  {Object} arg            Objeto con la informacion necesaria
   * @param  {String} arg.container  Nombre del contenedor del archivo
   * @param  {String} arg.path       Path del archivo
   * @param  {String} arg.metadata   Objeto que contendrá los metadatos a establecer   
   * @param  {String} arg.metadata.metadata   Objeto con metadatos personalizados para el objeto
   * @return {Promise<Object>}       Promesa con la información del archivo.    
  */
  setFileMetadata(arg){
    return new Promise((resolve, reject) => {
      arg = normalizeArgs(this.service, arg);
      checkContainer(arg);

      if(!arg.metadata){
        reject(App.err.badRequest("metadata property not found"));
      }else{
        this.getFsObject().setFileMetadata(arg)
          .then(doc => {
            let obj = createFileForResponse(this.service, arg, doc.path, doc.url, arg.public);
            resolve({file:obj});
          })
          .catch(reject); 
      }
    });
  }


}

/**
 * Crea un objeto con la información de un archivo. Dependiendo del objeto loc, la información estará representada en formato de referencia o de servicio y contenedor
 * @private
 * @param  {String}  service            Servicio de ubicacion del archivo
 * @param  {Object}  loc                Objeto con información de la ubicación del archivo
 * @param  {Object}  loc.container      Contenedor en el que está ubicado el archivo.
 * @param  {Object}  [loc.reference]    Referencia en la que está ubicado el archivo. Si se pasa una referencia la información se devolverá en formato dereferencia
 * @param  {String}  path               Path en el que esta ubicado el archivo
 * @param  {String}  [url]              URL del archivo
 * @param  {Boolean} isPublic           Indica si el archivo es públic o no
 * @return {Object}                     Objeto con la información del archivo
 */
function createFileForResponse(service, loc, path, url, isPublic = false){
  let obj = {};
  if(loc.reference){
    obj = Storage.toReferenceObject({service: service, container: loc.container, path: path});
  }else{
    obj.path = path;
    obj.service = service;
    obj.container =  loc.container;  
  } 
  obj.public = isPublic;
  obj.url = url;
  return obj;
}

/** 
 * Funcion que normaliza los argumentos. 
 * @private
 * @param  {Object} arg Argumentos a normalizar
 * @return {Object}     Argumentos normalizados
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

/**
 * Funcion que comprueba que un objeto de ubicación tenga container.
 * @private
 * @param  {Object} loc             Objeto que representa una ubicación de un archivo
 * @param  {String} loc.container   Contenedor del archivo
 * @param  {String} [loc.reference] Referencia de ubicación del archivo. 
 */
function checkContainer(loc){
  if(!loc.container)
    throw new Error(loc.reference ? "Cannot find container for reference" : "You must provide a container or a reference");
}

Storage.multer = multer({dest:appDir+'/../uploads'});

module.exports = Storage;
