var gcloud = require('gcloud');
var fs = require('fs-extra');
var path = require('path');

let App;
let log;

let keyFilePath;// = appDir+"/../cert/";
let gtoken;

/**
 * Servicio de almacenamiento de GCloud
 * @private
 * @memberOf module:tb-storage
 */
class A2sGcloud{

  /**
   * Crea una instancia del servicio de GCloud
   * @param  {Object} _app                  Objeto App de la aplicación
   * @param  {Object} options               Objeto con las credenciales para el modulo
   * @param  {String} options.projectId     ProjectId de GCloud
   * @param  {Object} options.keyFile       Objeto con información del keyFile de GCloud
   * @param  {String} options.keyFile.cert  Path relativo a la carpeta "cert" del proyecto con la ubicación del keyFile de GCloud
   */
  constructor(_app, options){
    App = _app;
    log = App.log.child({module:'gcloud-storage'});
    keyFilePath = App.certsPath;
  
    this.options = options;
    log.trace("A2sGcloud INIT");
    log.debug(options);
    this.gcs = gcloud.storage({
      projectId: options.projectId,
      keyFilename: path.join(keyFilePath,options.keyFile.cert)
    });
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
    log.debug("createContainer");
    log.debug(arg.container);
    var name = arg.container;
    return new Promise((resolve, reject) => {
      this.gcs.createBucket(name, (err, bucket) =>{
        if (!err) {
          log.debug(bucket.metadata);
          if(arg.public){
            bucket.makePublic(err => {
              if(err) resolve(err)
              else resolve({_id:name,path: bucket.metadata.selfLink});
            });
          }else{
            resolve({_id:name,path: bucket.metadata.selfLink});
          }
        } else{
          log.debug(err);
          reject(err);
        }
      });
        
    });
  }

  /**
   * Obtiene información de un contenedor
   * 
   * @param {Object} arg            Objeto payload que recibe el metodo
   * @param {string} arg.container  Nombre del contenedor
   * @return {Promise<Object>}      Promesa con la información del contenedor.    
  */
  getContainerInfo(arg) {
    log.debug("getContainerInfo");
    return new Promise((resolve,reject) => {
      let bucket = this.gcs.bucket(arg.container);
      bucket.getMetadata((err, metadata, apiResponse) => {
        if(err) reject(err);
        else resolve({_id:metadata.id,path:metadata.selfLink})
      });
    });
  }

  /**
   * Elimina un contenedor
   * 
   * @param {Object} arg            - Objeto payload que recibe el metodo
   * @param {String} arg.container  - nombre del contenedor que deseamos eliminar
   * @param {Boolean} arg.force     - Flag para indicar si la eliminación es forzada
   * @return {Promise<Object>}       Promesa con la información del contenedor.    
  */
  deleteContainer(arg) {
    log.debug("deleteContainer");
    return new Promise((resolve,reject) => {
      let bucket = this.gcs.bucket(arg.container);
      if(arg.force){
        bucket.deleteFiles({force:true},errors => {
          bucket.delete((err, apiResponse) => {
            if(err)reject(err)
            else resolve({_id:arg.container});
          });
        })
      }else{
        bucket.delete((err, apiResponse) => {
          if(err)reject(err)
          else resolve({_id:arg.container});
        });
      } 
        
    });
  }

  /**
   * Obtiene todos los contenedores
   * @return {Promise<Array>}  Promesa con los contenedores cargados
  */
  getContainers() {
    log.debug("getContainers");
    return new Promise((resolve,reject) => {
      this.gcs.getBuckets((err, buckets) => {
        if (!err) { 
          // buckets is an array of Bucket objects.
          let respContainer = buckets.map(bucket => {
            return {_id:bucket.metadata.id,path:bucket.metadata.selfLink};
          })
          resolve(respContainer);
        }else{
          reject(err);
        }
      });
    });
  }

  /**
   * Permite almacenar un archivo en el contenedor indicado
   * 
   * @param {arg}     arg             - Objeto payload que recibe el metodo
   * @param {string}  arg.container   - nombre del contenedor sera guardado el archivo
   * @param {string}  arg.path        - nombre con el cual se guardará el archivo (formato test/test1/text.txt)
   * @param {File}    arg.file        - Objeto que representa al archivo que deseamos guardar
   * @param {Boolean} arg.public      - Indica si el archivo será publico o no
   * @return {Promise<Object>}       Promesa con la información del archivo.    
  */
  uploadFile(arg) {
    return new Promise((resolve,reject) => {
      var file = arg.file.path;
      // log.debug(file,arg.container);
      var bucket = this.gcs.bucket(arg.container);
      var dest = arg.path;
      var options = { destination: arg.path };

      bucket.upload(file,options,(err,f) => {
        if(!err){
          if(arg.public){
            f.makePublic((err, resp) => {});
          }else{
            f.makePrivate({strict: true},(err, resp) => {});
          }
          let obj = createFileResponseObject(f.metadata.name, f.metadata.size, f.metadata.mediaLink, arg.public);
          resolve(obj);
        }else{
          reject(err);
        }
      });
    });
  }

  /**
   * Obtiene todos los archivos de una ubicación
   * 
   * @param {Object} arg           - Objeto payload que recibe el metodo
   * @param {String} arg.container - Nombre del contenedor donde se encuentra dicho archivo
   * @param {String} arg.path      - Path del que se quiere obtener la informacion
   * @return {Promise<Array>}     Devuelve una promesa al array con información sobre todos los archivos de la ubicacion indicada
  */
  getFiles(arg){
    log.debug("getFiles");
    return new Promise((resolve,reject) => {
      let container = arg.container;
      let option = {};
      if(arg.path){
        option.prefix = arg.path;// = path.join(arg.container, arg.path);
      }
      var bucket = this.gcs.bucket(container);
      bucket.getFiles(option, (err, files) => {
       if (!err) {
        
          let promises = files.map(f =>{
            return checkPublic(f)
                     .then(isPublic => Promise.resolve(createFileResponseObject(f.metadata.name, f.metadata.size, f.metadata.mediaLink, isPublic)) )
                     .catch(err => Promise.resolve(undefined));
          });
          
          Promise.all(promises)
            .then(filesObjects => resolve(filesObjects.filter(fileObject => fileObject != undefined)));
          // resolve(respFiles);
        }else{
          reject(err);
        }
      });
    });
  }

  /**
   * Obteniene información sobre un archivo
   * 
   * @param {Object} arg - Objeto Payload que recibe el metodo
   * @param {String} arg.container - Nombre del contenedor donde se encuentra dicho archivo
   * @param {String} arg.path - Nombre del archivo
   *
   * @return {Promise<Object>} Promesa con la información del archivo
  */
  getFileInfo(arg) {
    log.debug("getFileInfo");
    return new Promise((resolve,reject) => {
      var bucket = this.gcs.bucket(arg.container);
      var file = bucket.file(arg.path);
      file.getMetadata((err, metadata, apiResponse) => {
        if(metadata){
          log.debug(metadata);
          checkPublic(file)
            .then(isPublic =>{
              let obj = createFileResponseObject(metadata.name, metadata.size, metadata.mediaLink, isPublic);
              resolve(obj);
            })
            .catch(reject);
        }else{
          reject(err ? err : new Error("Metadata don't found"));
        }
      });
    });
  }

  /**
   * Cambia el estado de publico del archivo
   * @param  {Object} arg            Objeto con la informacion necesaria
   * @param  {String} arg.container  Nombre del contenedor del archivo
   * @param  {String} arg.path       Path del archivo
   * @param  {String} arg.public     Nuevo estado de público del archivo
   * @return {Promise<Object>}       Promesa con la información del archivo.    
  */
  makeFilePublic(arg) {
    log.debug("makeFilePublic");
    return new Promise((resolve,reject) => {
      var bucket = this.gcs.bucket(arg.container);
      var file = bucket.file(arg.path);

      let callback = (err, resp) => {
        log.debug("RESP");
        log.debug(resp);
        file.getMetadata((err, metadata, apiResponse) => {
          if(err){
            reject(err);
          }else if(metadata){
            log.debug(metadata);

            let obj = createFileResponseObject(metadata.name, metadata.size, metadata.mediaLink, arg.public);
            resolve(obj);
          
          }else{
            reject(new Error("Metadata don't found"));
          }
        });
      }

      console.log("Making public", arg.public)
      if(arg.public){
        file.makePublic(callback);
      }else{
        file.makePrivate({strict: true},callback);
      }
    });
  }

  /**
   * Mueve un archivo de una ubicación a otra
   * @private
   */
  moveFile(arg) {
    log.debug("moveFile");
    return new Promise((resolve,reject) => {
      var bucket = this.gcs.bucket(arg.container);
      var file = bucket.file(arg.srcFile);
      log.debug(arg);
      file.move(arg.destFile,(err, destinationFile, apiResponse) => {
        if(err){
          reject(err);
        }else{
          checkPublic(file)
            .then(isPublic =>{
              destinationFile.getMetadata((err, metadata, apiResponse) => {
                if(err) reject(err);
                else resolve(createFileResponseObject(metadata.name, metadata.size, metadata.mediaLink, isPublic));
              });
            })
            .catch(reject);
        }
      });
    });
  }

  /**
   * Copia un archivo de una ubicación a otra
   * @private
   */
  copyFile(arg) {
    log.debug("copyFile");
    return new Promise((resolve,reject) => {
      var bucket = this.gcs.bucket(arg.container);
      var file = bucket.file(arg.srcFile);
      log.debug(arg);
      file.copy(arg.destFile,(err, destinationFile, apiResponse) => {
        if(err){
          reject(err);
        }else{
          destinationFile.getMetadata((err, metadata, apiResponse) => {
            if(err)reject(err);
            else resolve(createFileResponseObject(metadata.name, metadata.size, metadata.mediaLink));
          });
        }
      });
    });
  }

  /**
   * Permite obtener un archivo del servidor
   * 
   * @param {Object} arg                Objeto payload que recibe el metodo
   * @param {String} arg.container      Nombre del contenedor donde se encuentra dicho archivo (opcional)
   * @param {String} arg.path           Nombre del archivo que se desea descargar
   * @param {Stream.Writable} arg.res   Flujo por donde se devuelve el fichero
   * @return {Promise} Una promesa
  */
  getFile(arg){
    log.debug("getFile");
    return new Promise((resolve, reject) => {
      var bucket = this.gcs.bucket(arg.container); 
      var remoteFile = bucket.file(arg.path);

      var readStream = remoteFile.createReadStream();
      
      readStream.on('error', error => {
        log.debug(error);
        reject(error);
      });
      readStream.on('end', () => {
        log.debug("download file end");
        resolve();
      });
      readStream.pipe(arg.res);
    }); 
  }

  /**
   * Elimina un archivo
   * 
   * @param {ctx} arg - Objeto payload que recibe el metodo
   * @param {string} arg.container - Nombre del contenedor donde se encuentra el archivo
   * @param {string} arg.path - Path del archivo a eliminar
   * @return {Promise<Object>}       Promesa con la información del archivo.    
  */
  deleteFile(arg) {
    log.debug("deleteFile");
    var doc = {_id:arg.path};
    return new Promise((resolve,reject) => {
      var bucket = this.gcs.bucket(arg.container);
      var file = bucket.file(arg.path);
      file.getMetadata((err, metadata, apiResponse) => {
        if(err)reject(err);
        else{
          file.delete((err, apiResponse) => {
            if(err)reject(err)
            else resolve(createFileResponseObject(metadata.name, metadata.size, metadata.mediaLink));
          });
        }
      });
    });
  }

  /**
   * Elimina todos los archivos de un path específico 
   * 
   * @param {Object} arg              Objeto payload que recibe el metodo
   * @param {String} arg.container    Nombre del contenedor donde se encuentra el archivo
   * @param {String} arg.path         Nombre del path a Eliminar
   * @return {Promise<Object>}        Promesa con la información de los archivos eliminados.
  */
  deleteFiles(arg) {
    log.trace("deleteFiles");
    return new Promise((resolve,reject) => {
      let options = {};
      if(arg.path){
        options.prefix = arg.path;
      }
      var bucket = this.gcs.bucket(arg.container);
      bucket.deleteFiles(options ,err => {
          if(!err) resolve();
          else reject(err);
      });
    });
  }

  /**
   * Genera un token de acceso para GCloud
   * 
   * @param  {Object} _app        Objeto App del servidor
   * @param  {Object} credentials Objeto con las credenciales de acceso para el servicio.
   * @param  {Number} minTime     Duración requerida para el token. Como máximo se puede generar un token de media hora
   * @return {Promise<Object>}    Promesa con el objeto con la información del token
   */
  static genToken(_app, credentials, minTime){
    return new Promise((resolve, reject) => {
      if(!credentials){
        throw new Error("Not gcloud credentias found.");
      }

      minTime = Math.min(minTime, 3600); //Maximo una hora
      var now = (new Date()).getTime();
      let prevToken = createTokenData(gtoken) 
      let needToInit = !gtoken || (gtoken.token && gtoken.expires_at && ((now + (minTime * 1000)) >= gtoken.expires_at));
      if(needToInit){
        let GoogleToken = require('gtoken');
        gtoken = GoogleToken({
          keyFile: path.join(_app.certsPath, credentials.keyFile.cert),
          scope: ['https://www.googleapis.com/auth/devstorage.read_only'] // or space-delimited string of scopes 
        });
      }
      gtoken.getToken( (err, token) => {
        if (err) {
          if(prevToken){
            resolve(prevToken);
          }else{
            reject(err);
          }
        } else {
          resolve(createTokenData(gtoken));
        }
      });
      
    });     
  }
}


/**
 * Comprueba el estado de público de un archivo
 * @private
 * @param  {GCloud.File} file Archivo de GCloud
 * @return {Promise<Boolean>} Promesa al estado de público del archivo
 */
function checkPublic(file){
  return new Promise((resolve,reject)=>{
    file.acl.get({entity:"allUsers"}, function(err, aclObject, apiResponse){
      resolve(aclObject && aclObject.role == 'READER')
    });
  });
}

/**
 * Crea un objeto con la información de un archivo
 * @private
 * @param  {String}  subPath      [description]
 * @param  {String}  relativePath [description]
 * @param  {Number}  size         [description]
 * @param  {String}  url          [description]
 * @param  {Boolean} isPublic     [description]
 * @return {Object}               [description]
 */
function createFileResponseObject(relativePath, size, url, isPublic = undefined){

  var info = {_id:relativePath};
  info.size = size;
  info.public = isPublic; 
  info.path = relativePath;
  info.url = url;

  return info;
}

/**
 * Crea un objeto con la información de un token de gcloud
 * @private
 * @param  {GCloud.token} gtoken Objeto token de google
 * @return {Object}       Objeto con la informacion del token
 */
function createTokenData(gtoken){
  let tokenData;
  if(gtoken){
    tokenData = { };
    tokenData.token = gtoken.token;
    tokenData.expires_at = gtoken.expires_at;
    // if(gtoken.raw_token)
    //   tokenData.type = gtoken.raw_token.token_type;
  }
  return tokenData;
}

module.exports = A2sGcloud;
