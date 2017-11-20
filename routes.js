

let router = new require('express').Router();
let multer = require('multer');
let path = require('path');
var appDir = path.dirname(require.main.filename);
let upload = multer({dest:appDir+'/../uploads'});
// TODO: this require needs to be fixed. re-structure.
let Storage = require('./index.js');
let storage = new Storage( );


let log;

/**
 * Rest API del módulo de almacenamiento, tb-storage.
 * 
 * @module tb-storage/routes
 */
function setupRoutes(App){

  log = App.log.child({module:'storageRoute'});

  log.debug("Setup routes storage");

  function getFSInstance(service){
    if(service && storage.service != service){
      return new Storage(service);
    }
    return storage;
  }

  // router.user(multer({dest:'./uploads'}));
  router.use(function(req, res, next){
    req._ctx['service']  = "storage";
    req._ctx['resource']  = req.query.service;
    next();
  });


  /**
   * Devuelve informacion
   * Para indicar otro servicio distinto de local pasar el parametro "service". Si no se especifica, el almacenamiento será local. (Ej. "service=gcloud")
   * 
   * @name Get file or container info
   *
   * @route  {GET} srv/storage/
   *
   * @queryparam {String} [service] Servicio de almacenamiento del que cargar los contenedores. (Ej. "service=gcloud")
   * @queryparam {String} [container] Contenedor(Ej. "container=mycontainer")
   * 
   * @queryparam {String} [reference] Referencia de la que obtener información. (Ej: "myReference")
   * 
   * @queryparam {String} [path] Path del que se quiere obtener la informacion, puede ser una subcarpeta (Ej: "subdir/") o una ruta a un archivo (Ej: "file.png" ó "subdir/file.png")
   *
   *
   * @return [Object]  Dependiendo de la información solicitada devolvera información distinta. 
   * 
   * @example 
   *   A continuacion una relacion entre los argumentos pasados y la información devuelta.
   *   
   *   Nota: Si la informacion se solicita con una referencia, la informacion devuelta será devuelta en formato de referencia
   *  
   *   - service                              -> Lista de los contenedores del servicio
   *   - service, container                   -> Lista de los archivos del contenedor en el servicio indicado
   *   - service, container, path(directorio) -> Lista de los archivos en el path dentro del contenedor para el servicio indicado 
   *   - service, container, path(archivo)    -> Información del archivo en el path dentro del contenedor para el servicio indicado 
   *
   *   - reference                            -> Lista de los archivos en la referencia indicada
   *   - reference, path(directorio)          -> Lista de los archivos en el subpath de la referencia indicada
   *   - reference, path(archivo)             -> Información del archivo en el path dentro de la referencia indicada
   *
   *  
   * GET:  http://localhost:4999/api/v1/srv/storage?service=gcloud
   * GET:  http://localhost:4999/api/v1/srv/storage?service=gcloud&container=myContainer
   * GET:  http://localhost:4999/api/v1/srv/storage?service=gcloud&container=myContainer&path=file.png
   * GET:  http://localhost:4999/api/v1/srv/storage?service=gcloud&container=myContainer&path=subdir%2Ffile.png
   * GET:  http://localhost:4999/api/v1/srv/storage?reference=myReference
   * GET:  http://localhost:4999/api/v1/srv/storage?reference=myReference&path=file.png
   * GET:  http://localhost:4999/api/v1/srv/storage?reference=myReference&path=subdir%2Ffile.png
   */
  router.get("/",function(req, res, next){
    var ctx = req._ctx;
    
    ctx.payload.service = ctx.resource;
    ctx.payload.container = req.query.container;
    if(req.query.path)
      ctx.payload.path = decodeURI(req.query.path);

    ctx.payload.reference = req.query.reference;

    ctx.payload = processArgs(ctx.payload);

    if(ctx.payload.service && ctx.payload.container && ctx.payload.path){
      if(ctx.payload.path.length == 0 || ctx.payload.path.endsWith('/')){
        ctx.method = 'getFiles';
      }else{
        ctx.method = 'getFileInfo';
      }
    }else if(ctx.payload.service && ctx.payload.container){
      ctx.method = 'getFiles';
    }else{
      ctx.method = 'getContainers';
    }
    ctx.model = "storage";

    getFSInstance(ctx.payload.service).do(ctx)
      .then(resp => res.status(200).json(resp))
      .catch(next);
  }); //Probado local, gcloud, aws



  /**
   * Descarga un archivo de un contenedor indicado
   * 
   * @name Download file
   *
   * @route  {GET} srv/storage/download
   *
   * @queryparam {String} [service]   Servicio de almacenamiento del que descargar el archivo. (Ej. "service=gcloud")
   * @queryparam {String} [container] Nombre del contenedor del que descargar el archivo
   * 
   * @queryparam {String} [reference] Referencia de la que descargar el archivo. (Ej: "myReference")
   * 
   * @queryparam {String} [path] Path del archivo que se quiere descargar (Ej. "myFile.png", "subdir/file.png")
   * 
   * @return El archivo descargado
   *
   * @example
   *  GET: http://localhost:4999/api/v1/srv/storage/download?service=gcloud&container=test-container&path=file.jpg
   */
  router.get("/download",function(req, res, next){
    
    var ctx = req._ctx;
    if(req.query.path)
      ctx.payload.path = decodeURI(req.query.path);

    ctx.payload.service = ctx.resource;
    ctx.payload.container = req.query.container;

    ctx.payload.reference = req.query.reference;
    // ctx.payload.arg = req.query.arg;

    ctx.payload.res = res;//TODO: (sergio) ver esto detenidamente

    ctx.payload = processArgs(ctx.payload);

    ctx.method = 'downloadFile';
    ctx.model = "storage";

    res.setHeader('Content-disposition', 'attachment; filename=' + ctx.payload.path);

    getFSInstance(ctx.payload.service).do(ctx)
      .then(() => {
        log.debug("file downloado ok");
      })
      .catch(next);

  }); //Probado local, aws




    /**
   * Sube un archivo al contenedor especificado. Post en formato multipart
   * Para indicar otro servicio distinto de local pasar el parametro "service". Si no se especifica, el almacenamiento será local. (Ej. "service=gcloud")
   *
   * @name Upload file
   *
   * @route  {POST} srv/storage/upload
   * 
   * @queryparam {String} [service]   Servicio de almacenamiento al que subir el archivo. (Ej. "service=gcloud")
   * @queryparam {String} [container] Nombre del contenedor al que subir el archivo
   * 
   * @queryparam {String} [reference] Referencia a la que subir el archivo. (Ej: "myReference")
   *
   * @queryparam {String} [public]    "true" Para indicar que el archivo será público. Cualquier otro valor será tomado como no public.
   * 
   * @bodyparam  {File}   fileUpload  Archivo que se va a subir
   * @bodyparam  {String} path        Path destino del archivo incluyendo el nombre y extension. Ejemplos: "filename.png", "subdir/filename.png"
   * 
   * @return {Object}  Informacion del archivo subido 
   *
   * @example: 
   *   UPLOAD: http://localhost:4524/api/v1/srv/storage/upload?service=gcloud&container=test-container&public=true
   *   DATOS multipart:
   *        - "path" : "file.png"
   *        - "fileUpload": El archivo a subir
   *   
   *   RESPUESTA: 
   *   {
   *     "file": {
   *       "path": "file.png",
   *       "service": "gcloud",
   *       "container": "test-container",
   *       "public": true,
   *       "url": "https://www.googleapis.com/download/storage/v1/b/test-container/o/file.png?generation=1504095147348420&alt=media"
   *     }
   *   }
   *
   *          
   */
  router.post("/upload",upload.single('fileUpload'),function(req, res, next){
    log.trace("entra en upload file");
    log.debug(req.file);
    log.debug(req.body.path);

    var ctx = req._ctx;
    ctx.payload.service = ctx.resource;
    ctx.payload.container = req.query.container;

    ctx.payload.reference = req.query.reference;
    ctx.payload.arg = req.query.arg;

    ctx.payload.public = req.query.public && req.query.public == 'true';
    
    if(ctx.payload.reference && ctx.payload.reference == 'temporal'){
      ctx.payload.arg = createRandomString(8);
    }

    if(req.file)
      ctx.payload.file = req.file;
    ctx.payload.path = req.body.path;
   
    ctx.payload = processArgs(ctx.payload);
    // ctx.payload.body = req.body;
    log.debug(ctx.payload);
    ctx.model = "storage";
    ctx.method = 'uploadFile';
    
    getFSInstance(ctx.payload.service).do(ctx)
    .then(resp => res.status(200).json(resp))
      .catch(next);
  });  //Probado local, gcloud, aws





  /**
   * Elimina un contenedor o archivos dependiendo de los parámetros pasados
   * Para indicar otro servicio distinto de local pasar el parametro "service". Si no se especifica, el almacenamiento será local. (Ej. "service=gcloud")
   *
   * @name Delete file or container 
   *
   * @route  {DELETE} srv/storage/
   *
   * @queryparam {String} [service] Servicio de almacenamiento del que eliminar el contenedor. (Ej. "service=gcloud")
   * @queryparam {String} [container] Nombre del contenedor que se quiere eliminar (Ej. "container=mycontainer")
   * 
   * @queryparam {String} [reference] Referencia de la que eliminar información. (Ej: "myReference")
   * 
   * @queryparam {String} [path] Path del que se quiere eliminar la informacion, puede ser una subcarpeta (Ej: "subdir/") o una ruta a un archivo (Ej: "file.png" ó "subdir/file.png")
   *
   * @queryparam {String} [force] Flag para forzar la eliminación de un contenedor aunque tenga archivos
   * 
   * @return [Object]  Dependiendo de la información solicitada devolvera información distinta. 
   * 
   *
   * @example
   *
   *   A continuacion una relacion entre los argumentos pasados y la informacion que se elimina.
   *   
   *   Nota: Si la informacion se solicita con una referencia, la informacion devuelta será devuelta en formato de referencia
   *  
   *   - service, container                   -> Elimina el contenedor en el servicio indicado
   *   - service, container, path(directorio) -> Elimina los archivos en el path dentro del contenedor para el servicio indicado 
   *   - service, container, path(archivo)    -> Elimina el archivo en el path dentro del contenedor para el servicio indicado 
   *
   *   - reference                            -> Elimina los archivos en la referencia indicada
   *   - reference, path(directorio)          -> Elimina los archivos en el subpath de la referencia indicada
   *   - reference, path(archivo)             -> Elimina el archivo en el path dentro de la referencia indicada
   *
   *  
   *  DELETE: http://localhost:4999/api/v1/srv/storage?service=gcloud
   *  DELETE: http://localhost:4999/api/v1/srv/storage?service=gcloud&container=myContainer
   *  DELETE: http://localhost:4999/api/v1/srv/storage?service=gcloud&container=myContainer&path=file.png
   *  DELETE: http://localhost:4999/api/v1/srv/storage?service=gcloud&container=myContainer&path=subdir%2Ffile.png
   *  DELETE: http://localhost:4999/api/v1/srv/storage?reference=myReference
   *  DELETE: http://localhost:4999/api/v1/srv/storage?reference=myReference&path=file.png
   *  DELETE: http://localhost:4999/api/v1/srv/storage?reference=myReference&path=subdir%2Ffile.png
   */
  router.delete('/', function(req, res, next) { 
    let invalidArgs = false;
    var ctx = req._ctx;
    // ctx.payload.name = req.params.container;
    ctx.payload.service = ctx.resource;
    ctx.payload.container = req.query.container;
    if(req.query.path)
      ctx.payload.path = decodeURI(req.query.path);

    ctx.payload.reference = req.query.reference;

    ctx.payload.force = req.query.force;
    // ctx.payload.arg = req.query.arg;

    ctx.payload = processArgs(ctx.payload);

    if(ctx.payload.service && ctx.payload.container && ctx.payload.path){
      if(ctx.payload.path.length == 0 || ctx.payload.path.endsWith('/')){
        ctx.method = 'deleteFiles';
      }else{
        ctx.method = 'deleteFile';
      }
    }else if(ctx.payload.service && ctx.payload.container){
      ctx.method = 'deleteContainer';
    }else{
      invalidArgs = true;
    }

    ctx.model = "storage";
  
    if(invalidArgs){
      next(App.err.badData("A service and container or a reference must be specified"));
    }else{
      getFSInstance(ctx.payload.service).do(ctx)
        .then(resp => res.status(200).json(resp))
        .catch(next);
    }
  }); //Probado local, gcloud, aws




  /**
   * Crea un contener con los datos de la petición. 
   * Para indicar otro servicio distinto de local pasar el parametro "service". Si no se especifica, el almacenamiento será local. (Ej. "service=gcloud")
   *
   * @name Create container
   *
   * @route  {POST} srv/storage
   *
   * @queryparam  {String}  [service] Servicio de almacenamiento en el que crear el contedor. (Ej. "service=gcloud")
   *
   * @queryparam   {String}  container Nombre del contenedor que se va a crear
   * @queryparam   {String}  [public]    Flag que indica si el contenedor será público
   * 
   * @return {Container}  El contenedor creado
   *  
   * @example 
   * POST:  http://localhost:4999/api/v1/srv/storage?service=gcloud&container=my-container
   *
   * RESPUESTA:
   * {
   *   "container": {
   *     "_id": "containerExample",
   *     "path": "https://www.googleapis.com/storage/v1/b/containerExample"
   *   }
   * }  
   */
  router.post("/",function(req, res, next){
    var ctx = req._ctx;
    ctx.payload.service = ctx.resource;
    ctx.payload.container = req.query.container;

    ctx.model = "storage";
    ctx.method = 'createContainer';

    getFSInstance(ctx.payload.service).do(ctx)
      .then(resp => res.status(200).json(resp))
      .catch(next);
  }); //Probado local, gcloud, aws


  /**
   * Hace public o privado un archivo
   *
   * @name Make file public
   * 
   * @route  {POST} srv/storage/public
   * 
   * @queryparam {String}  [service] Servicio de almacenamiento en el que se encuentra el archivo. (Ej. "service=gcloud")
   * @queryparam {String}  [container] Nombre del contenedor en el que se encuentra el archivo
   * 
   * @queryparam {String}  [reference] Referencia en la que se encuentra el archivo (Ej: "myReference")
   * 
   * @queryparam {String}  [path] Path en el que se encuentra el archivo, puede ser una subcarpeta (Ej: "subdir/") o una ruta a un archivo (Ej: "file.png" ó "subdir/file.png")
   * @queryparam {String}  [public]    Flag que indica si el contenedor será público o privado. "true" Para indicar que el archivo será público. Cualquier otro valor será tomado como no public.
   * 
   * @return {Object}       Archivo al que se le cambio la privacidad
   */
  router.post("/public",function(req, res, next){
    var ctx = req._ctx;
    // ctx.payload.name = req.params.container;
    ctx.payload.service = ctx.resource;
    ctx.payload.container = req.query.container;
    if(req.query.path)
      ctx.payload.path = decodeURI(req.query.path);

    ctx.payload.reference = req.query.reference;

    ctx.payload.public = req.query.public;
    // ctx.payload.arg = req.query.arg;

    ctx.payload = processArgs(ctx.payload);

    ctx.model = "storage";
    ctx.method = 'makeFilePublic';

    getFSInstance(ctx.payload.service).do(ctx)
      .then(resp => res.status(200).json(resp))
      .catch(next);
  }); //Probado local, gcloud, aws


  /**
   * Obtiene un access token del servicio indicado
   *
   * @name Get token
   *
   * @route  {GET} srv/storage/get-token
   *
   * @queryparam  {String}  [service] Servicio de almacenamiento del que se quiere obtener el token (Ej. "service=gcloud")
   * @queryparam  {String}  [minTime] Tiempo minimo de duracion del token en segundos. Como máximo puede ser una hora (3600 segundos).
   * 
   * @return {Container}  El contenedor creado
   *  
   * @example 
   * GET:  http://localhost:4999/api/v1/srv/storage/get-token?service=gcloud&mintime=500
   *
   * RESPUESTA:
   * {
   *   "token": "xxXX.Elq4BMJxXxX-GcGC34ji8HevvXxxx6EQ5XZzDX56aN1oXXXXsvsTP7SmHgxJ-RogPzWjxxXplspMwMSyXXXXXgZvkozPZXgv5Fu5HxxxwBC74g4bH2JeK_7xXM",
   *   "expires_at": 1504172051000
   * }  
   */
  router.get("/get-token",function(req, res, next){
    var ctx = req._ctx;

    let service = ctx.resource;
    let minTime = req.query.mintime;

    Storage.genToken(service, minTime)
      .then(resp => {
        res.status(200).json(resp); 
      })
      .catch(err => {next(err)});
  }); //Probado local, gcloud, aws

  App.app.use(`${App.baseRoute}/srv/storage`, router);
}

/**
 * Procesa los argumentos de la peticion
 * @private
 * @param  {Object} arg Los argumentos a procesar
 * @return {Object}     Los argumentos procesados
 */
function processArgs(arg){
  let newArgs = Object.assign({},arg);
  if(newArgs){
    if((!newArgs.service || !newArgs.container) && newArgs.reference){
      log.trace("processing reference");
      delete newArgs.service;
      delete newArgs.container;

      if(newArgs.reference && newArgs.arg){
        newArgs.path = path.join(newArgs.arg,newArgs.path);
      }

      let data = Storage.toServiceObject({reference: newArgs.reference, path: newArgs.path})
      if(data){
        newArgs.service = data.service;
        newArgs.container = data.container;
        newArgs.path = data.path;
      }
    }else{
      log.trace("processing service");
      delete newArgs.reference;
    }
  }
  log.debug("processed args", newArgs);
  return newArgs;
}

/**
 * Crea un string aleatoreo de longitud dada. 
 * @private
 * @param  {Number} [length] Longitud del string. Por defecto es 8
 * @return {String}        El string generado
 */
function createRandomString(length = 8){
  var randomstring = require("randomstring");
  return randomstring.generate(length);
}

module.exports = setupRoutes;