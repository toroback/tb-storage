var fs = require('fs-extra');
var recursive = require('recursive-readdir');
var path = require('path');

let App;
let log;
let rootUrl;

var _defaultPath = "./storage";

/**
 * Servicio de almacenamiento local
 * @private
 * @memberOf module:tb-storage
 */
class A2sLocal{

  /**
   * Crea una instancia del servicio Local
   * @param  {Object} _app                          Objeto App de la aplicación
   * @param  {Object} [options]                     Objeto con la configuración del servicio
   * @param  {String} [options.rootPath]            Path base en el que se almacenaran los archivos en local. Por defecto se almacenan bajo "./storage"
   */
  constructor(_app, options){

    App = _app;
    log = App.log.child({module:'local-storage'});

    rootUrl = App.serverOptions.host+":"+App.serverOptions.port+"/"+path.normalize(_defaultPath)+"/";

    this.options = options || {};

    this.rootPath = this.options.rootPath || (App.basePath + "../"+_defaultPath);
    
    log.debug("A2sLocal: "+this.rootPath);
    var that = this;
    fs.access(this.rootPath, err => {
      if(err){
        fs.mkdirs(that.rootPath, err => {
          if(err)log.debug(err);
        });
      }
    });
  }

  /**
   * Devuelve el path de un archivo almacenado en local
   * @param  {Object} app       Objeto App de la aplicación
   * @param  {String} container Nombre del contenedor en el que esta ubicado el archivo
   * @param  {String} subPath   Path relativo al contenedor de la ubicación
   * @return {String}           El path del archivo
   */
  static getLocalPath(app, container, subPath){
    return path.join(app.basePath, "..", _defaultPath, container, subPath);
  }


  /**
   * Crea un contenedor de archivos
   * @param {Object} arg            - Objeto payload que recibe el metodo
   * @param {String} arg.container  - Nombre del contenedor a crear
   * 
   * @return {Promise<Object>} Promesa con la información del contenedor
  */
  createContainer(arg) {
    log.debug("createContainer");
    return new Promise((resolve, reject) => {
      var name = arg.container;
      if(checkName(name)){
        var containerPath = path.join(this.rootPath, name);
        fs.access(containerPath, err => {
          if(err){
            fs.mkdirs(containerPath, err => {
              if(err){
                reject(err);
              }else{
                var stat = fs.statSync(containerPath);
                resolve({_id:name, size:stat.size});
              }
            });
          }else{
            reject(new Error("Container already exists. Please select another name."));
          }
        });
      }else{
        reject(new Error("Invalid container name: "+name));
      }
        
    });
  }

  /**
   * Obtiene información de un contenedor
   * 
   * @param {Object} arg            Objeto payload que recibe el metodo
   * @param {String} arg.container  Nombre del contenedor
   * @return {Promise<Object>}      Promesa con la información del contenedor.    
  */
  getContainerInfo(arg) {
    log.debug("getContainerInfo");
    return new Promise((resolve,reject) => {
      var mypath = path.join(this.rootPath, arg.container);
      
      fs.stat(mypath,(err,stat) => {
        if(err){
          console.log(err);
          reject(App.err.notFound("container not found - " + arg.container));
        }else{          
          resolve({_id:arg.container, size:stat.size});
        }
      });
    });
  }

  /**
   * Elimina un contenedor
   * 
   * @param {Object} arg             Objeto payload que recibe el metodo
   * @param {String} arg.container   Nombre del contenedor que deseamos eliminar
   * @param {Boolean} arg.force      Flag para indicar si la eliminación es forzada
   * @return {Promise<Object>}       Promesa con la información del contenedor.    
  */
  deleteContainer(arg) {
    log.debug("deleteContainer");
    return new Promise((resolve,reject) => {
      var mypath = createFilePath(this.rootPath, undefined, arg.container);
      fs.stat(mypath, (err,stat) => {
        if(err){
          reject(App.err.notFound("container not found - " + arg.container));
        }else{
          fs.remove(mypath, err => {
            if(err)reject(err);
            resolve({_id:arg.container});
          });
        }
      });
    });
  }

  /**
   * Obtiene todos los contenedores
   * @return {Promise<Array>}  Promesa con los contenedores cargados
  */
  getContainers() {
    log.debug("getContainers");
    return new Promise((resolve,reject) => {
      var mypath = this.rootPath
      fs.stat(mypath, (err,stat) => {
        if(err){
          reject(App.err.notFound("container not found"));
        }else{
          fs.readdir(mypath, (err,containers) => {
            // log.debug(containers);
            var respContainer = [];
            containers.forEach( containerName => {
              var containerPath = path.join(mypath, containerName);
              var stat = fs.statSync(containerPath);
              if(stat.isDirectory()){
                respContainer.push({_id:containerName,size:stat.size});
              }
            });
            resolve(respContainer);
          })
        }
      });
    });
  }

  /**
   * Devuelve el path base del servicio
   * @return {String} El path base
   */
  getRootPath(){
    return this.rootPath;
  }

  /**
   * Permite almacenar un archivo en el contenedor indicado
   * 
   * @param {Object}  arg             - Objeto payload que recibe el metodo
   * @param {string}  arg.container   - nombre del contenedor sera guardado el archivo
   * @param {string}  arg.path        - nombre con el cual se guardará el archivo (formato test/test1/text.txt)
   * @param {File}    arg.file        - Objeto que representa al archivo que deseamos guardar
   * @return {Promise<Object>}       Promesa con la información del archivo.  
  */
  uploadFile(arg) {
    log.debug("uploadFile");
    return new Promise((resolve,reject) => {
      let file = arg.file.path;
      log.debug(file,arg.container);
      let dest = arg.path;
      
      let pathDest = createFilePath(this.rootPath, arg.container, undefined) + "/";
      
      log.debug(pathDest);
      let fileDest = pathDest+dest;
      let relativePath = dest.substr(0, dest.lastIndexOf('/'));
      let dir = pathDest;
      if(relativePath){
        dir = createFilePath(dir,relativePath, undefined);
      }

      log.debug(dir);
      fs.ensureDirSync(dir);
     
      copyData(fileDest,file)
        .then(() => {
          fs.stat(fileDest, (err,stat) => {
            if(err){
              reject(App.err.notFound("file not found"))
            }else{   
              let respObj = createFileResponseObject(arg.container, undefined, dest, stat.mtime, stat.size, true, !stat.isFile());
            
              fs.remove(file, err => {
                log.debug("upload temp borrado. error:" + err);
                resolve(respObj);
              });
            }
          });
        })
        .catch(reject);
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
    return new Promise((resolve,reject) =>{
     
      var mypath = this.rootPath+"/";
      if(arg.container)
        mypath =  path.join(mypath,arg.container)+"/";
      
      if(arg.path)
        mypath = path.join(mypath,arg.path);
  
      fs.stat(mypath, (err,stat) => {
        if(err){
          reject(App.err.notFound("path not found"));
        }else{
          if(arg.recursive){
            recursive(mypath, [".*" ], (err, files) => {
              var respFiles = [];
              files.forEach(filePath => {
                var stat = fs.statSync(filePath);
                if(stat.isFile()){
                  filePath = filePath.replace(rootPath,"");

                  var info = createFileResponseObject(arg.container, arg.path, filePath, stat.mtime, stat.size, true, !stat.isFile());
                  respFiles.push(info);
                }
              });
              log.debug(respFiles);
              resolve(respFiles);
            });
          }else{
            fs.readdir(mypath, (err,files) => {
              var respFiles = [];
              files.forEach( filePath => {
                var stat = fs.statSync(mypath+filePath);      
                var info = createFileResponseObject(arg.container, arg.path, filePath, stat.mtime, stat.size, true, !stat.isFile());
                respFiles.push(info);
              });
              resolve(respFiles);
            });
          }
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
    return new Promise( (resolve,reject) => {
      let pathFile = createFilePath(this.rootPath, arg.container, arg.path);
      fs.stat(pathFile, (err,stat) => {
        if(err) reject(App.err.notFound("file not found"))
        else{   
          var info = createFileResponseObject(arg.container, undefined, arg.path, stat.mtime, stat.size, true, !stat.isFile());
          log.debug(info);
          resolve(info);
        }
      });
    });
  }

  /**
   * Mueve un archivo de una ubicación a otra
   * @private
   */
  moveFile(arg) {
    log.debug("moveFile");    
    return new Promise( (resolve,reject) => {
      let oldFile = createFilePath(this.rootPath, arg.container, arg.srcFile);
      let newFile = createFilePath(this.rootPath, arg.container, arg.destFile);

      fs.stat(oldFile, (err,stat) => {
        if(err) reject(App.err.notFound("file not found"));
        else{
          fs.move(oldFile, newFile, err => {
            if(err) reject(App.err.notFound("file not found"));
            else{
              // var info = {_id:arg.destFile};
              fs.stat(newFile, (err,stat) => {
                if(err) reject(App.err.notFound("container not found"));
                else{
                  var info = createFileResponseObject(arg.container, undefined, arg.destFile, stat.mtime, stat.size, true,!stat.isFile());
                  // info.mtime = stat.mtime.getTime()/1000;
                  // info.size = stat.size;
                  // info.public = true; //De momento lo locales son siempre public
                  log.debug(info);
                  resolve(info);
                }
              });
            } 
          });
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
    return new Promise( (resolve,reject) => {
      let oldFile = createFilePath(this.rootPath, arg.container, arg.srcFile);
      let newFile = createFilePath(this.rootPath, arg.container, arg.destFile);

      fs.stat(oldFile, (err,stat) => {
        if(err) reject(App.err.notFound("file not found"));
        else{
          fs.copy(oldFile, newFile, err => {
            if(err) reject(App.err.notFound("file not found"));
            else{
              // var info = {_id:arg.destFile};
              fs.stat(newFile, (err,stat) => {
                if(err) reject(App.err.notFound("container not found"));
                else{
                  var info = createFileResponseObject(arg.container, undefined, arg.destFile, stat.mtime, stat.size, true, !stat.isFile());
                  // info.mtime = stat.mtime.getTime()/1000;
                  // info.size = stat.size;
                  // info.public = true; //De momento lo locales son siempre public
                  log.debug(info);
                  resolve(info);
                }
              });
            } 
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
      let pathFile = createFilePath(this.rootPath, arg.container, arg.path);

      log.debug(pathFile);
      var readStream = fs.createReadStream(pathFile);
      readStream.pipe(arg.res);
      readStream.on('error', function(error){
        log.debug(error);
        reject(error);
      });
      readStream.on('end', function(){
        log.debug("download file end");
        resolve();
      });
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
    // var doc = {_id:arg.path};
    // log.debug(doc);
    return new Promise((resolve,reject) => {
      let containerPath = createFilePath(this.rootPath, arg.container, undefined);
      var pathFile = createFilePath(containerPath,arg.path);
      log.debug(pathFile);
      fs.stat(pathFile, (err,stat) => {
        if(err){
          reject(App.err.notFound("file not found"));
        }else{
          fs.unlink(pathFile, err => {
            cleanFromDirToDir(containerPath, path.parse(pathFile).dir)
              .then(cleaned =>{    
                if(err){
                  reject(err);
                }else {
                  var info = createFileResponseObject(arg.container, undefined, arg.path, stat.mtime, stat.size, true, !stat.isFile());
                  resolve(info)
                };
              })
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
    log.debug("deleteFiles");
 
    return new Promise((resolve,reject) => {
      let containerPath = createFilePath(this.rootPath, arg.container, undefined);
      var pathDir = createFilePath(containerPath,arg.path);

      fs.readdir(pathDir, (err, files) => {
        if (err){
          reject(error)
        }else{
          files.forEach( file => {
             fs.unlinkSync(path.join(pathDir, file));
          });
          cleanFromDirToDir(containerPath, pathDir);
          resolve();
        }
      });
    });
  }

  /**
   * No disponible.
   * Cambia el estado de publico del archivo.
   * @param  {Object} arg            Objeto con la informacion necesaria
   * @param  {String} arg.container  Nombre del contenedor del archivo
   * @param  {String} arg.path       Path del archivo
   * @param  {String} arg.public     Nuevo estado de público del archivo
   * @return {Promise<Object>}       Promesa con la información del archivo.    
  */
  makeFilePublic(arg) {
    log.debug("makeFilePublic");
    return new Promise((resolve,reject) => {
      reject(new Error("Operation not allowed for local files")); // TODO: provisionalmente no se puede cambiar para local
    });
  }

  setFileMetadata(arg) {
    log.debug("setFileMetadata");
    return new Promise((resolve,reject) => {
      reject(new Error("Operation not allowed for local files")); // TODO: provisionalmente no se puede cambiar para local
    });
  }

}

/**
 * Copia un archivo en otra ubicacion
 * @private
 */
function copyData(savPath, srcPath) {
  return new Promise((resolve, reject) => {
    fs.readFile(srcPath, (err, data) => {
        if(err){
          reject(err);
        }else{
          fs.writeFile (savPath, data, (err) => {
              if(err){
                reject(err);
              }else{
                log.debug('copy file end');
                resolve();
              }
          });
        }
    });
  });
}


// function cleanPath(path){
//   log.debug("entra en clean");
//   fs.readdir(path, (err,folders) => {
//     folders.forEach( folder => {
//       var localPath = path+"/"+folder;
//       var stat = fs.statSync(localPath);
//       if(stat.isDirectory()){
//         fs.readdir(localPath,(err,subFolders) => {
//           if(subFolders.length == 0)
//             fs.rmdir(localPath);
//           else
//             cleanPath(localPath);
//         });
//       }
//     });
//   });
// }

/**
 * Elimina la ruta entre containerPath y dirPath si los directorios estan vacíos completamente 
 * @private
 * @param  {String} startDir  Directorio a partir del que se quiere limpiar 
 * @param  {String} endDir    Subdirectorio de startDir con el que forma la ruta que se quiere limpiar 
 * @return {Promise}          Promesa que indica si se pudo limpiar o no la ruta
 */
function cleanFromDirToDir(startDir, endDir){
  return new Promise((resolve, reject) =>{
    //Se normalizan ambos paths para poder compararlos y saber si dirPath contiene a containerPath
    let normContainerPath = path.normalize(startDir);
    let normPath = path.normalize(endDir);
    var exit = false;

    //Mientras normPath sea subpath de normContainerPath, no sean el mismo, y este vacío eliminar las carpetas vacias
    while(normPath.startsWith(normContainerPath) && normPath != normContainerPath && !exit){ 
      log.debug("Cleaning path: "+ normPath);
      let files = fs.readdirSync(normPath);
      if (files.length == 0){
          fs.rmdirSync(normPath);
          normPath = path.normalize(normPath+"/..");
      }else{
          exit = true;
      }
    } 
    resolve(normPath == normContainerPath);
  })
}

// function newContainer(name, path, stat){
//   return {_id:name, path:path, size:stat.size};
// }

/**
 * Comprueba que el nombre de un contenedor este permitido
 * @private
 * @param  {String} name Nombre del contenedor
 * @return {Boolean}  Indica si es correcto o no
 */
function checkName(name){
  log.debug("checkName");
  log.debug(name);
  if(name.indexOf("/") == -1)
    return true;
  else
    return false;
}


/**
 * Crea un path basado en los componentes pasados
 * @private
 * @param  {String} rootDir  root del path
 * @param  {String} subpath  subpath entre root y el filename
 * @param  {String} fileName nombre del archivo
 * @return {String}          El path creado
 */
function createFilePath(rootDir, subpath, fileName){
  let filePath = rootDir;
  if(subpath){
    let trimSubpath = subpath.trim();
    if(trimSubpath.length > 0){
      var containsLeft = filePath.endsWith("/");
      var containsRight = trimSubpath.startsWith("/");
      filePath = filePath + path.normalize(((containsLeft || containsRight) ? "" : "/" ) + trimSubpath ); //Se normaliza la parte del path que se va a añadir para que no dupliquen las '/''
    }
  }

  if(fileName){
    let trimFileName = fileName.trim();
    if(trimFileName.length > 0){
      var containsLeft = filePath.endsWith("/");
      var containsRight = trimFileName.startsWith("/");
      filePath = filePath + path.normalize(((containsLeft || containsRight) ? "" : "/" ) + trimFileName );//Se normaliza la parte del path que se va a añadir para que no dupliquen las '/''
    }
  }
  return filePath;
}

/**
 * Crea un objeto con la información de un archivo
 * @private
 * @param  {String}  container    Nombre del contenedor
 * @param  {String}  subPath      Subpath desde el contenedor hasta el archivo
 * @param  {String}  relativePath Path del archivo a partir del subPath
 * @param  {Number}  mtime        Ultima fecha de modificación
 * @param  {Number}  size         Tamaño del archivo
 * @param  {Boolean} isPublic     Indica si el archivo es public o no
 * @param  {Boolean} isDir        Indica si es una carpeta o no
 * @return {Object}               Un objeto con la información del archivo
 */
function createFileResponseObject(container, subPath, relativePath, mtime, size, isPublic = true, isDir = false){
  let baseUrl = createFilePath(rootUrl, container, subPath);

  var info = {_id:relativePath};
  info.type = isDir ? "dir": "file";
  info.mtime = mtime.getTime()/1000;
  info.size = size;
  info.public = isPublic; //De momento lo locales son siempre public
  info.path = path.join(subPath || "",relativePath);
  if(!isDir){
    info.url = createFilePath(baseUrl,relativePath);
  }

  return info;
}


module.exports = A2sLocal;
