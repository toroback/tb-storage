var gcloud = require('gcloud');
var fs = require('fs-extra');
var path = require('path');

let App;
let log;

// var appDir = path.dirname(require.main.filename);

let keyFilePath;// = appDir+"/../cert/";
let gtoken;

class A2sGcloud{
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
      var dest = arg.path;
      var options = { destination: arg.path };

      bucket.upload(file,options,(err,f) => {
        if(!err){
          if(arg.public)
            f.makePublic((err, resp) => {});

          let obj = createFileResponseObject(undefined, f.metadata.name, f.metadata.size, f.metadata.mediaLink, arg.public);
          resolve(obj);
        }else{
          reject(err);
        }
      });
    });
  }


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
          // buckets is an array of Bucket objects.
          let respFiles = files.map(f =>{
            return createFileResponseObject(undefined, f.metadata.name, f.metadata.size, f.metadata.mediaLink);
            // return {_id:file.metadata.name,size:file.metadata.size,path:file.metadata.mediaLink};
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
      var file = bucket.file(arg.path);
      file.getMetadata((err, metadata, apiResponse) => {
        if(err){
          reject(err);
        }else if(metadata){
          log.debug(metadata);
           let obj = createFileResponseObject(undefined, metadata.name, metadata.size, metadata.mediaLink);
           resolve(obj);
          // resolve({_id:metadata.name,size:metadata.size,path:metadata.selfLink})
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
      var file = bucket.file(arg.path);

      let callback = (err, resp) => {
        log.debug("RESP");
        log.debug(resp);
        file.getMetadata((err, metadata, apiResponse) => {
          if(err){
            reject(err);
          }else if(metadata){
            log.debug(metadata);

            let obj = createFileResponseObject(undefined, metadata.name, metadata.size, metadata.mediaLink, arg.public);
            resolve(obj);
            // resolve({_id:metadata.name,size:metadata.size,path:metadata.selfLink})
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
            else resolve(createFileResponseObject(undefined, metadata.name, metadata.size, metadata.mediaLink));
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
            else resolve(createFileResponseObject(undefined, metadata.name, metadata.size, metadata.mediaLink));
          });
        }
      });
    });
  }

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
            else resolve(createFileResponseObject(undefined, metadata.name, metadata.size, metadata.mediaLink));
          });
        }
      });
    });
  }

  deleteFiles(arg) {
    log.trace("deleteFiles");
    //var doc = {_id:arg.file};
    return new Promise((resolve,reject) => {
      let options = {};
      if(arg.path){
        options.prefix = arg.path;// = path.join(arg.container, arg.path);
      }
      var bucket = this.gcs.bucket(arg.container);
      bucket.deleteFiles(options ,err => {
          if(!err) resolve();
          else reject(err);
      });
    });
  }

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

function createFileResponseObject(subPath, relativePath, size, url, public = undefined){

  var info = {_id:relativePath};
  info.size = size;
  info.public = public; 
  info.path = path.join(subPath || "",relativePath);
  info.url = url;

  return info;
}


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
