
var AWS = require('aws-sdk');
var fs = require('fs-extra');
var path = require('path');

let App;
let log;

// TODO: crear awsS3 afuera hace que se sobreescriba la instancia de S3 si se instancia dos veces el Storage
// --> si this.awsS3 está fuera de los prototype, funciona? no he probado.
// --> no, no funciona.... le puse el prototype a todos mientras reorganizamos este módulo
// var rootPath = null;
let _defaultRegion = 'eu-central-1';

class AWSStorage{
  constructor(_app, options){
    App = _app;
    log = App.log.child({module:'aws-storage'});
    this.options = options;
    log.trace("AWSStorage INIT");
    log.debug(options);
    this.awsS3 = new AWS.S3({  // pasar la versión
      accessKeyId: options.accessKeyId,
      secretAccessKey: options.secretAccessKey, 
      region: options.regions || _defaultRegion
    });
  }

  createContainer(arg) {
    log.debug("createContainer");
    log.debug(arg.container);
    var name = arg.container;
    return new Promise((resolve, reject) => {
      this.awsS3.createBucket({Bucket: name, ACL: (arg.public ? "public-read" : undefined)}, (err, data) => {
        if (err) reject(err);
        else resolve(bucketObject(this.awsS3, name));
      });
    });
  }

  getContainerInfo(arg) {
    log.debug("getContainerInfo");
    return new Promise((resolve,reject) => {
      this.awsS3.headBucket({Bucket: arg.container}, (err, data) => {
        console.log("getContainerInfo data",data);
        if (err) reject(err); // an error occurred
        else resolve(bucketObject(this.awsS3, arg.container));
      });
    });
  }

  deleteContainer(arg) {
    log.debug("deleteContainer");
    return new Promise((resolve,reject) => { 

      let preDelete;
      if(arg.force)
        preDelete = deleteBucketFiles(this.awsS3, arg.container);
      else
        preDelete = Promise.resolve();
      
      preDelete
        .then(resp => deleteBucket(this.awsS3, arg.container))
        .then(resp => resolve({_id:arg.container}))
        .catch(reject);

    });
  }

  getContainers() {
    log.debug("getContainers");
    return new Promise((resolve,reject) => {
      this.awsS3.listBuckets((err, data) => {
        if(err){
          reject(err); // an error occurred
        }else{
          let respContainer = data.Buckets.map(elem => bucketObject(this.awsS3, elem.Name));
          resolve(respContainer);
        }  
      });
    });
  }

  uploadFile(arg) {
    log.debug("uploadFile");
    return new Promise((resolve,reject) => {
      var file = arg.file.path;
      var dest = arg.path;
      console.log("aws arg",arg);
      // Read in the file, convert it to base64, store to S3
      fs.readFile(file, (err, data) => {
        if(err){ 
          reject(err); 
        }else{
          var params = {
            Bucket: arg.container,
            Key: dest,
            ACL: (arg.public ? 'public-read': undefined),
            Body: new Buffer(data, 'binary')
          }

          this.awsS3.putObject(params, (err, data) => {
            if(err) reject(err);
            else{
              console.log('uploaded!!', data);
              resolve(fileObject(this.awsS3, dest, arg.container, data.ContentLength, arg.public));

            }
          });
        }
      });

    });
  }


  getFiles(arg){
    log.debug("getFiles");
    return new Promise((resolve,reject) => {
      let container = arg.container;
      let params = {Bucket: container};
      if(arg.path){
        params.Prefix = arg.path;
      }
      this.awsS3.listObjectsV2(params, (err, data) => {
        if(err) reject(err); // an error occurred
        else{
          let promises = data.Contents.map(file =>{
            return checkPublic(this.awsS3, {Bucket: params.Bucket, Key: file.Key})
                     .then(isPublic => Promise.resolve(fileObject(this.awsS3, file.Key, container, file.Size, isPublic)) )
                     .catch(err => Promise.resolve(undefined));
          });
          
          Promise.all(promises)
            .then(filesObjects => resolve(filesObjects.filter(fileObject => fileObject != undefined)));


          // var respFiles = data.Contents.map(file => fileObject(this.awsS3, file.Key, container, file.Size));
          // resolve(respFiles);
        }    
      });
    });
  }

  getFileInfo(arg) {
    log.debug("getFileInfo");
    return new Promise((resolve,reject) => {
      let params = {Bucket: arg.container, Key: arg.path};
      this.awsS3.headObject(params, (err, data) => {
        if(data){
          checkPublic(this.awsS3, params)
            .then(isPublic => resolve(fileObject(this.awsS3, arg.path, arg.container, data.ContentLength, isPublic)) )
            .catch(reject);
        }else{
          reject(err ? err : new Error("File not found"));
        }
      });
    });
  }

  makeFilePublic(arg) {
    log.debug("makeFilePublic");
    return new Promise((resolve,reject) => {
      this.awsS3.putObjectAcl({Bucket: arg.container, Key: arg.path, ACL: (arg.public ? 'public-read' : 'private')}, (err, data) => {
        if(err){
          reject(err); // an error occurred
        }else{
          this.awsS3.headObject({Bucket: arg.container, Key: arg.path}, (err, data) => {
            if(err){ 
              reject(err); // an error occurred
            }else if(!data){
              reject(new Error("File not found"));
            }else{
              resolve(fileObject(this.awsS3, arg.path, arg.container, data.ContentLength, arg.public));
            }     
          });
        }     
      });
    });
  }

  moveFile(arg) {
    log.debug("moveFile");
    return new Promise((resolve,reject) => {
      let copySource = path.normalize(arg.container+'/'+arg.srcFile);
      this.awsS3.copyObject({Bucket: arg.container, Key: arg.destFile, CopySource: copySource, ACL: (arg.public ? "public-read" : undefined) }, (err, data) => {
        if(err){ 
          reject(err); // an error occurred
        }else{
          this.awsS3.deleteObject({Bucket: arg.container, Key: arg.srcFile}, (err, data) => {
            if(err){
              reject(err); // an error occurred
              this.awsS3.deleteObject({Bucket: arg.container, Key: arg.destFile}, (err, data) => {
                console.log("Archivo copiado eliminado por que se produjo un error");
              });
            }else{
              resolve(fileObject(this.awsS3, arg.srcFile, arg.container, data.ContentLength));        // successful response
            }
          });
        } 
      }); 
    });
  }

  copyFile(arg) {
    log.debug("copyFile");
    return new Promise((resolve,reject) => {    
      this.awsS3.copyObject({Bucket: arg.container, Key: arg.destFile, CopySource: arg.container+'/'+arg.srcFile, ACL: (arg.public ? "public-read" : undefined) }, (err, data) => {
        if(err) reject(err); // an error occurred
        else resolve(fileObject(this.awsS3, arg.srcFile, arg.container, data.ContentLength) );        // successful response
      });  
    });
  }

  getFile(arg){
    log.debug("getFile");
    return new Promise((resolve, reject) => {
      var readStream = this.awsS3.getObject({Bucket: arg.container, Key: arg.path}).createReadStream();

      readStream.on('error', (error) => {
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
    return new Promise((resolve,reject) => {
      this.awsS3.deleteObject({Bucket: arg.container, Key: arg.path}, (err, data) => {
        if(err) reject(err); // an error occurred
        else resolve(fileObject(this.awsS3, arg.path, arg.container, 0));           // successful response
      });
    });
  }

  deleteFiles(arg){
    return deleteBucketFiles(this.awsS3, arg.container, arg.path);
  } 

}

// { Grantee: 
//    { Type: 'Group',
//      URI: 'http://acs.amazonaws.com/groups/global/AllUsers' },
//   Permission: 'READ' }
//   

/**
 * Comprueba la privacidad de un objeto
 * @param  {AWS} awsS3  
 * @param  {Object} params Objeto que indica el Bucket y el Key del objeto
 * @return {Promise<Boolean>}        Promesa que indica si es público o no
 */
function checkPublic(awsS3, params){
  return new Promise((resolve,reject)=>{
    if(params && params.Bucket && params.Key){
      awsS3.getObjectAcl(params, (err, data) => {
        if(data){
          var isPublic = undefined;
          data.Grants.forEach(grant => {
            if (isPublic == undefined){
              if(grant.Grantee && grant.Grantee.Type == 'Group' && grant.Grantee.URI == 'http://acs.amazonaws.com/groups/global/AllUsers'){
                isPublic = grant.Permission == 'READ';
              }
            }
          });
          
          resolve(isPublic ? isPublic : false);
        }else{
          log.error(err ? err: new Error("Unexpected error while checking ACL"));
          resolve(false);
        }
      });
    }else{
      reject(new Error("File not specified"));
    }
  });
}

  /**
   * Crea la url de un archivo
   * @param  {String} bucket El nombre del bucket donde está almacenado
   * @param  {String} key    El nombre del archivo 
   * @return {String}        La url
   */
  function fileUrl(awsS3, bucket, key){
    // let expires = 60 * 60 * 24 * 365 * 4; // 4 años.. por poner algo largo TODO: cambiar si es necesario
    // var params = {Bucket: bucket, Key: key, Expires: expires}
    // return awsS3.getSignedUrl('getObject', params);
    return bucketUrl(awsS3, bucket)+'/'+key;
  }

  /**
   * Crea la url de un bucket
   * @param  {String} bucket El nombre del bucket donde está almacenado
   * @return {String}        La url
   */
  function bucketUrl(awsS3, bucket){
    return awsS3.endpoint.href+bucket;
  }
  /**
   * Crea un objeto con información de un archivo.
   * @param  {String} name   Nombre del archivo
   * @param  {String} bucket Nombre del bucket en el que está almacenado
   * @param  {Number} size   Tamaño del arhivo (Opcional)
   * @return {Object}        Un objeto con la información
   */
  function fileObject(awsS3, name, bucket, size, isPublic = undefined){
    let obj = {_id: name, url: fileUrl(awsS3, bucket, name), path: name, public: isPublic};
    if(size) obj.size = size;
    return obj;
  }

  /**
   * Crea un objeto con la información de un bucket
   * @param  {String} name Nombre del bucket
   * @return {Object}      Un objeto con la información
   */
  function bucketObject(awsS3, name){
    return {_id:name, path: bucketUrl(awsS3, name)}
  }

  function deleteBucket(awsS3, name){
    return new Promise((resolve,reject) => {
      awsS3.deleteBucket({Bucket: name}, (err, data) => {
        if(err)reject(err); // an error occurred
        else resolve(data); // successful response
      });
    });
  }


  function deleteBucketFiles(awsS3, bucket, prefix){
    return new Promise((resolve,reject) => {
      let params = {Bucket: bucket};
      if(prefix)
        params.Prefix = prefix;

      awsS3.listObjectsV2(params, (err, data) => {
        if(err){
          reject(err); // an error occurred
        }else{
          var files = data.Contents.map(file => { return {Key: file.Key} });

          if(files.length > 0){
            awsS3.deleteObjects({Bucket: bucket, Delete: {Objects: files}}, (err, data) => {
              if(err) reject(err); // an error occurred
              else resolve(files);           // successful response
            });
          }else{
            resolve(files);
          }
        }    
      });
    });
  }


module.exports = AWSStorage;
