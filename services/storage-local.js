
var fs = require('fs-extra');
var recursive = require('recursive-readdir');
var path = require('path');

// var log = App.log.child({module:'local-storage'});

// var fsPath = __dirname+"/../../app/fs";
// var rootUrl = "http://localhost:5400/fs/";
// var rootPath = "/Users/sergio.garcia/Desktop/Desarrollo/a2sadmin";
// var rootPath = null;

let App;
let log;
let rootUrl;

var _defaultPath = "./storage";


class A2sLocal{
  constructor(_app, rootPath, options){

    App = _app;
    log = App.log.child({module:'local-storage'});

    rootUrl = App.serverOptions.host+":"+App.serverOptions.port+"/"+path.normalize(_defaultPath)+"/";

    this.rootPath = rootPath || (App.basePath + "../"+_defaultPath);
    this.options = options;
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

  createContainer(arg) {
    log.debug("createContainer");
    return new Promise((resolve, reject) => {
      var name = arg.name;
      if(checkName(name)){
        var containerPath = path.normalize(this.rootPath+"/"+name);
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

  getContainerInfo(arg) {
    log.debug("getContainerInfo");
    return new Promise((resolve,reject) => {
      var mypath = path.normalize(this.rootPath+"/"+arg.name);
      
      fs.stat(mypath,(err,stat) => {
        if(err){
          console.log(err);
          reject(App.err.notFound("container not found"));
        }else{          
          resolve({_id:arg.name, size:stat.size});
        }
      });
    });
  }

  deleteContainer(arg) {
    // var mypath = __dirname+"/../../app/fs/"+arg.container;
    log.debug("deleteContainer");
    return new Promise((resolve,reject) => {
      var mypath = createFilePath(this.rootPath, undefined, arg.name);
      fs.stat(mypath, (err,stat) => {
        if(err){
          reject(new Error("container not found"));
        }else{
          fs.remove(mypath, err => {
            if(err)reject(err);
            resolve({_id:arg.name});
          });
        }
      });
    });
  }

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
              var containerPath = path.normalize(mypath+"/"+containerName);
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

  getRootPath(){
    return this.rootPath;
  }

  uploadFile(arg) {
    log.debug("uploadFile");
    return new Promise((resolve,reject) => {
      let file = arg.file.path;
      log.debug(file,arg.container);
      let dest = decodeURI(arg.path);
      
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
          resolve({_id:dest,path:createFilePath(rootUrl, arg.container, dest)});
          fs.remove(file, err => log.debug("upload temp borrado"));
        })
        .catch(reject);
    });
  }

  getFiles(arg){
    // var rootUrl = "http://192.168.1.36:4500/fs/";
    log.debug("getFiles");
    // var container = {_id:name,path:rootUrl+name};
    return new Promise((resolve,reject) =>{
      var mypath = this.rootPath+"/";
      if(arg.container){
        mypath = mypath+arg.container+"/";
      }else if(arg.path){
        mypath = mypath+arg.path;
      }

      fs.stat(mypath, (err,stat) => {
        if(err){
          reject(new Error("path not found"));
        }else{
          if(arg.recursive){
            recursive(mypath, [".*" ], (err, files) => {
              var respFiles = [];
              files.forEach(filePath => {
                var stat = fs.statSync(filePath);
                if(stat.isFile()){
                  //quitar dirname de la url
                  filePath = filePath.replace(rootPath,"");
                  // log.debug(filePath);
                  // var name = filePath.substr(filePath.indexOf(arg.container)+arg.container.length+1);
                  var name = filePath;
                  var info = {_id:name};
                  info.mtime = stat.mtime.getTime()/1000;
                  info.size = stat.size;
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
                var isDir = true;
                var stat = fs.statSync(mypath+filePath);
                if(stat.isFile()){
                  //quitar dirname de la url
                  isDir = false;
                }
                var name = filePath;
                var info = {_id:name};
                info.type = "file";
                if(isDir) info.type = "dir";
                info.mtime = stat.mtime.getTime()/1000;
                info.size = stat.size;
                respFiles.push(info);
              });
              resolve(respFiles);
            });
          }
        }
      });
    });
  }

  getFileInfo(arg) {
    // var mypath = __dirname+"/../../app/fs/"+arg.container+"/"+arg.file;
    log.debug("getFileInfo");
    var info = {_id:arg.file};
    // log.debug(mypath);
    return new Promise( (resolve,reject) => {
      let pathFile = createFilePath(this.rootPath, arg.container, arg.file);
      fs.stat(pathFile, (err,stat) => {
        if(err)reject(App.err.notFound("container not found"));
        info.mtime = stat.mtime.getTime()/1000;
        info.size = stat.size;
        log.debug(info);
        resolve(info);
      });
    });
  }

  moveFile(arg) {
    log.debug("moveFile");    
    return new Promise( (resolve,reject) => {
      let oldFile = createFilePath(this.rootPath, arg.container, arg.srcFile);
      let newFile = createFilePath(this.rootPath, arg.container, arg.destFile);

      fs.stat(oldFile, (err,stat) => {
        if(err){
          reject(new Error("file not found"));
        }else{
          fs.move(oldFile, newFile, err => {
            if(err){
              reject(new Error("file not found"));
            }else{
              var info = {_id:arg.destFile};
              fs.stat(newFile, (err,stat) => {
                if(err){
                  reject(App.err.notFound("container not found"));
                }else{
                  info.mtime = stat.mtime.getTime()/1000;
                  info.size = stat.size;
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

  copyFile(arg) {
    log.debug("copyFile");
    return new Promise( (resolve,reject) => {
      let oldFile = createFilePath(this.rootPath, arg.container, arg.srcFile);
      let newFile = createFilePath(this.rootPath, arg.container, arg.destFile);

      fs.stat(oldFile, (err,stat) => {
        if(err){
          reject(new Error("file not found"));
        }else{
          fs.copy(oldFile, newFile, err => {
            if(err){
              reject(new Error("file not found"));
            }else{
              var info = {_id:arg.destFile};
              fs.stat(newFile, (err,stat) => {
                if(err){
                  reject(App.err.notFound("container not found"));
                }else{
                  info.mtime = stat.mtime.getTime()/1000;
                  info.size = stat.size;
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

  getFile(arg){
    log.debug("getFile");
    return new Promise((resolve, reject) => {
      let pathFile = createFilePath(this.rootPath, arg.container, arg.file);

      log.debug(pathFile);
      var readStream = fs.createReadStream(pathFile);
      log.debug("readStream");
      readStream.pipe(arg.res);
      log.debug("readStream pipe");
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

  deleteFile(arg) {
    log.debug("deleteFile");
    var doc = {_id:arg.file};
    log.debug(doc);
    return new Promise((resolve,reject) => {
      let containerPath = createFilePath(this.rootPath, arg.container, undefined) + "/";
      var pathFile = containerPath+arg.file;
      log.debug(pathFile);
      fs.stat(pathFile, (err,stat) => {
        if(err){
          reject(App.err.notFound("file not found"));
        }else{
          fs.unlink(pathFile, err => {
            if(arg.clean) cleanPath(containerPath); //se limpia el 
            
            if(err) reject(err);
            else resolve(doc);
          });
        }
      });
    });
  }

}

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


function cleanPath(path){
  log.debug("entra en clean");
  fs.readdir(path, (err,folders) => {
    folders.forEach( folder => {
      var localPath = path+"/"+folder;
      var stat = fs.statSync(localPath);
      if(stat.isDirectory()){
        fs.readdir(localPath,(err,subFolders) => {
          if(subFolders.length == 0)
            fs.rmdir(localPath);
          else
            cleanPath(localPath);
        });
      }
    });
  });
}

// function newContainer(name, path, stat){
//   return {_id:name, path:path, size:stat.size};
// }

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


// var rootPath = null;
// var _defaultPath = "./fs";
// function A2sLocal(rootPath){
//   this.rootPath = rootPath || _defaultPath;
//   log.debug("A2sLocal: "+this.rootPath);
//   var that = this;
//   fs.access(this.rootPath, err => {
//     if(err){
//       fs.mkdirs(that.rootPath, err => {
//         if(err)log.debug(err);
//       });
//     }
//   });
// }



module.exports = A2sLocal;
