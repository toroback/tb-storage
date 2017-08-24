var gcloud = require('gcloud');
var fs = require('fs-extra');
var path = require('path');

let App;
let log;

var _defaultPath = "./storage";

// var appDir = path.dirname(require.main.filename);

let keyFilePath;// = appDir+"/../cert/";

class A2sGcloud{
  constructor(_app, rootPath, options){
    App = _app;
    log = App.log.child({module:'gcloud-storage'});
    keyFilePath = App.certsPath;
    this.rootPath = rootPath || _defaultPath;
    this.options = options;
    log.trace("A2sGcloud INIT");
    log.debug(options);
    this.gcs = gcloud.storage({
      projectId: options.projectId,
      keyFilename: keyFilePath+options.keyFile.cert
    });
  }

  createContainer(arg) {
    log.debug("createContainer");
    log.debug(arg.name);
    var name = arg.name;
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

  getContainerInfo(arg) {
    log.debug("getContainerInfo");
    return new Promise((resolve,reject) => {
      let bucket = this.gcs.bucket(arg.name);
      bucket.getMetadata((err, metadata, apiResponse) => {
        if(err) reject(err);
        else resolve({_id:metadata.id,path:metadata.selfLink})
      });
    });
  }

  deleteContainer(arg) {
    log.debug("deleteContainer");
    return new Promise((resolve,reject) => {
      let bucket = this.gcs.bucket(arg.name);
      if(arg.force){
        bucket.deleteFiles({force:true},errors => {
          bucket.delete((err, apiResponse) => {
            if(err)reject(err)
            else resolve({_id:arg.name});
          });
        })
      }else{
        bucket.delete((err, apiResponse) => {
          if(err)reject(err)
          else resolve({_id:arg.name});
        });
      } 
        
    });
  }

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

  uploadFile(arg) {
    return new Promise((resolve,reject) => {
      var file = arg.file.path;
      // log.debug(file,arg.container);
      var bucket = this.gcs.bucket(arg.container);
      var dest = decodeURI(arg.path);
      var options = { destination: arg.path };

      bucket.upload(file,options,(err,f) => {
        if(!err){
          if(arg.public)
            f.makePublic((err, resp) => {});
          
          let obj = {
            service : "gcloud",
            container :  arg.container,
            path : dest,
            public : (arg.public ? true: false),
            url : f.metadata.mediaLink
          }
          resolve(obj);

          // resolve({_id:f.metadata.name,size:f.metadata.size,path:f.metadata.mediaLink});
        }else{
          reject(err);
        }
      });
    });
  }


  getFiles(arg){
    log.debug("getFiles");
    return new Promise((resolve,reject) => {
      var bucket = this.gcs.bucket(arg.container);
      bucket.getFiles((err, files) => {
       if (!err) {
          // buckets is an array of Bucket objects.
          let respFiles = files.map(file =>{
            return {_id:file.metadata.name,size:file.metadata.size,path:file.metadata.mediaLink};
          })
          resolve(respFiles);
        }else{
          reject(err);
        }
      });
    });
  }

  getFileInfo(arg) {
    log.debug("getFileInfo");
    return new Promise((resolve,reject) => {
      var bucket = this.gcs.bucket(arg.container);
      var file = bucket.file(arg.file);
      file.getMetadata((err, metadata, apiResponse) => {
        if(err){
          reject(err);
        }else if(metadata){
          log.debug(metadata);
          resolve({_id:metadata.name,size:metadata.size,path:metadata.selfLink})
        }else{
          reject(new Error("Metadata don't found"));
        }
      });
    });
  }

  makeFilePublic(arg) {
    log.debug("makeFilePublic");
    return new Promise((resolve,reject) => {
      var bucket = this.gcs.bucket(arg.container);
      var file = bucket.file(arg.file);
      file.makePublic((err, resp) => {
        log.debug("RESP");
        log.debug(resp);
        file.getMetadata((err, metadata, apiResponse) => {
          if(err){
            reject(err);
          }else if(metadata){
            log.debug(metadata);
            resolve({_id:metadata.name,size:metadata.size,path:metadata.selfLink})
          }else{
            reject(new Error("Metadata don't found"));
          }
        });
      });
    });
  }

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
          destinationFile.getMetadata((err, metadata, apiResponse) => {
            if(err) reject(err);
            else resolve({_id:metadata.name,size:metadata.size,path:metadata.selfLink});
          });
        }
      });
    });
  }

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
            else resolve({_id:metadata.name,size:metadata.size,path:metadata.selfLink});
          });
        }
      });
    });
  }

  getFile(arg){
    log.debug("getFile");
    return new Promise((resolve, reject) => {
      var bucket = this.gcs.bucket(arg.container); 
      var remoteFile = bucket.file(arg.file);

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

  deleteFile(arg) {
    log.debug("deleteFile");
    var doc = {_id:arg.file};
    return new Promise((resolve,reject) => {
      var bucket = this.gcs.bucket(arg.container);
      var file = bucket.file(arg.file);
      file.delete((err, apiResponse) => {
        if(err)reject(err)
        else resolve(doc);
      });
    });
  }

  deleteFiles(arg) {
    log.trace("deleteFiles");
    //var doc = {_id:arg.file};
    return new Promise((resolve,reject) => {
      var bucket = this.gcs.bucket(arg.container);
      bucket.deleteFiles({
          prefix:arg.prefix
        },err => {
          if(!err) resolve();
          else reject(err);
        })
    });
  }

}



function copyData(savPath, srcPath) {
  return new Promise((resolve, reject) => {
    fs.readFile(srcPath, (err, data) => {
        if(err){
          reject(err);
        }else{
          fs.writeFile(savPath, data, err => {
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

// function download(savPath, url) {
//   return new Promise(function(resolve, reject){
//     var file = fs.createWriteStream(savPath);
    
//     request.get(url).on('error',function(err){
//       reject(err);
//     }).on('response',function(res){
//       res.on('data', function(data) {
//         file.write(data);
//       }).on('end', function() {
//         file.end();
//         resolve();
//       })
//     });
//   });
// }

function cleanPath(pathToClean){
  log.debug("entra en clean");
  fs.readdir(pathToClean,(err,folders) => {
    folders.forEach(folder => {
      var localPath = path.normalize(pathToClean+"/"+folder);
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






module.exports = A2sGcloud;
