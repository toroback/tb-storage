

let router = new require('express').Router();
let multer = require('multer');
let path = require('path');
var appDir = path.dirname(require.main.filename);
let upload = multer({dest:appDir+'/../uploads'});
// TODO: this require needs to be fixed. re-structure.
let Storage = require('./index.js');
let storage = new Storage( );


let log;

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

  //test Route
  router.get('/', function(req, res) {
      res.json({ message: 'A2Server Storage' });  
  });

  /**
   * Devuelve la informacion de un archivo para un contenedor y archivo dados
   * 
   * @name Get file's info
   * 
   * @route  {GET} srv/storage/containers/:container/files/:file
   * 
   * @routeparam {String} container Nombre del contenedor del que obtener el archivo
   * @routeparam {String} file Nombre completo del archivo que se quiere obtener (Ej. "myFile.png")
   *
   * @queryparam {String} [service] Servicio de almacenamiento en el que se encuentra el archivo. (Ej. "service=gcloud")
   *
   * @return {File} La información del archivo
   * 
   * @example
   *   GET: http://localhost:4999/api/v1/srv/storage/containers/containerExample/files/file.jpg?service=gcloud
   *    
   *   RESPUESTA:
   *   {
   *      "file": {
   *        "_id": "file.jpg",
   *        "size": "131829",
   *        "path": "https://www.googleapis.com/storage/v1/b/containerExample/o/file.jpg"
   *      }
   *    }
   */
  router.get("/containers/:container/files/:file",function(req, res, next){
    var ctx = req._ctx;
    ctx.payload.container = req.params.container;
    ctx.payload.file = req.params.file;

    ctx.model = "storage";
    ctx.method = 'getFileInfo';

    getFSInstance(ctx.resource).do(ctx)
      .then(resp => res.json(resp))
      .catch(next);
  }); //Probado local, gcloud, aws


  /**
   * Devuelve una lista de los archivos que hay en el contenedor indicado. 
   * 
   * @name Get container's files
   *
   * @route  {GET} srv/storage/containers/:container/files
   *
   * @queryparam {String} [service] Servicio de almacenamiento en el que se encuentran los archivos. (Ej. "service=gcloud")
   *
   * @routeparam {String} container Nombre del contenedor del que obtener los archivos
   * 
   * @return [{File}] Un array con los archivos
   *
   * @example
   *  GET: http://localhost:4999/api/v1/srv/storage/containers/containerExample/files?service=gcloud
   *  RESPUESTA:
   *  {
   *     "files": [
   *       {
   *         "_id": "file.jpg",
   *         "size": "131829",
   *         "path": "https://www.googleapis.com/download/storage/v1/b/containerExample/o/file.jpg?generation=1499779049548839&alt=media"
   *       }
   *     ]
   *  }
   */
  router.get("/containers/:container/files",function(req, res, next){
    var ctx = req._ctx;
    ctx.payload.container = req.params.container;

    ctx.model = "storage";
    ctx.method = 'getFiles';

    getFSInstance(ctx.resource).do(ctx)
      .then(resp => res.json(resp))
      .catch(next);
  }); //Probado local, gcloud, aws


  /**
   * Descarga un archivo de un contenedor indicado
   * 
   * @name Download file
   *
   * @route  {GET} srv/storage/containers/:container/download/:file
   *
   * @queryparam {String} [service]  Servicio de almacenamiento del que descargar el archivo. (Ej. "service=gcloud")
   *
   * @routeparam {String} container  Nombre del contenedor del que descargar el archivo
   * @routeparam {String} file       Nombre completo del archivo que se quiere descargar (Ej. "myFile.png")
   * 
   * @return El archivo descargado
   *
   * @example
   *  GET: http://localhost:4999/api/v1/srv/storage/containers/containerExample/download/file.jpg?service=gcloud
   */
  router.get("/containers/:container/download/:file",function(req, res, next){
    
    var file = req.params.file;
    // console.log(file);

    var ctx = req._ctx;
    ctx.payload.file = file;
    ctx.payload.container = req.params.container;
    ctx.model = "storage";
    ctx.payload.res = res;//TODO: (sergio) ver esto detenidamente
    ctx.method = 'downloadFile';
    // res.setHeader('Content-Type', 'image/png');
    // Content-Disposition: attachment; filename="picture.png"
    res.setHeader('Content-disposition', 'attachment; filename=' + file);

    getFSInstance(ctx.resource).do(ctx)
      .then(() => {
        log.debug("file downloado ok");
        // res.status(200).json(resp); 
      })
      .catch(next);

  }); //Probado local, aws


  /**
   * Devuelve los contenedores existentes
   * Para indicar otro servicio distinto de local pasar el parametro "service". Si no se especifica, el almacenamiento será local. (Ej. "service=gcloud")
   * 
   * @name Get containers
   *
   * @route  {GET} srv/storage/containers
   *
   * @queryparam {String} [service] Servicio de almacenamiento del que cargar los contenedores. (Ej. "service=gcloud")
   * 
   * @return [Container]  Un array con los contenedores
   * 
   * @example 
   *   - http://localhost:4999/api/v1/srv/storage/containers  para los contenedores locales
   *   - http://localhost:4999/api/v1/srv/storage/containers?service=gcloud  para los contenedores de gcloud
   */
  router.get("/containers",function(req, res, next){
    var ctx = req._ctx;
    ctx.method = 'getContainers';
    ctx.model = "storage";

    getFSInstance(ctx.resource).do(ctx)
      .then(resp => res.status(200).json(resp))
      .catch(next);
  }); //Probado local, gcloud, aws


  /**
   * Devuelve el contenedor para el nombre especificado
   * Para indicar otro servicio distinto de local pasar el parametro "service". Si no se especifica, el almacenamiento será local. (Ej. "service=gcloud")
   * 
   * @name Get container
   *
   * @route  {GET} srv/storage/containers/:container
   *
   * @queryparam {String} [service] Servicio de almacenamiento del que cargar el contenedor. (Ej. "service=gcloud")*
   *
   * @routeparam {String} container  Nombre del contenedor que se quiere obtener  
   * 
   * @return {Container}  El contenedor
   * 
   * @example 
   *   GET: http://localhost:4999/api/v1/srv/storage/containers/containerExample
   *   
   *   RESPUESTA:
   *   {
   *     "container": {
   *       "_id": "containerExample",
   *       "path": "https://www.googleapis.com/storage/v1/b/containerExample"
   *     }
   *   }  
   */
  router.get("/containers/:container",function(req, res, next){
    var ctx = req._ctx;
    ctx.payload.name = req.params.container;
    ctx.method = 'getContainerInfo';
    ctx.model = "storage";

    getFSInstance(ctx.resource).do(ctx)
      .then(resp => res.status(200).json(resp))
      .catch(next);
  }); //Probado local, gcloud, aws


  /**
   * Crea un contener con los datos de la petición. 
   * Para indicar otro servicio distinto de local pasar el parametro "service". Si no se especifica, el almacenamiento será local. (Ej. "service=gcloud")
   *
   * @name Create container
   *
   * @route  {POST} srv/storage/containers
   *
   * @queryparam  {String}  [service] Servicio de almacenamiento en el que crear el contedor. (Ej. "service=gcloud")
   *
   * @bodyparam   {String}  name      Nombre del contenedor que se va a crear
   * 
   * @return {Container}  El contenedor creado
   *  
   * @example 
   * POST:  http://localhost:4999/api/v1/srv/storage/containers?service=gcloud
   * DATOS: 
   * { 
   *   "name": "containerExample"
   * }
   * 
   *
   * RESPUESTA:
   * {
   *   "container": {
   *     "_id": "containerExample",
   *     "path": "https://www.googleapis.com/storage/v1/b/containerExample"
   *   }
   * }  
   */
  router.post("/containers",function(req, res, next){
    var ctx = req._ctx;
    ctx.model = "storage";
    ctx.method = 'createContainer';

    getFSInstance(ctx.resource).do(ctx)
      .then(resp => res.status(200).json(resp))
      .catch(next);
  }); //Probado local, gcloud, aws


  /**
   * Deletes a container with a given name
   * Para indicar otro servicio distinto de local pasar el parametro "service". Si no se especifica, el almacenamiento será local. (Ej. "service=gcloud")
   *
   * @name Delete container
   *
   * @route  {DELETE} srv/storage/containers/:container
   *
   * @queryparam {String} [service] Servicio de almacenamiento del que eliminar el contenedor. (Ej. "service=gcloud")
   *
   * @routeparam {String} container  Nombre del contenedor que se quiere eliminar
   * 
   * @return {Container} The deleted container
   *
   * @example
   *  
   * DELETE: http://localhost:4999/api/v1/srv/storage/containers/containerExample?service=gcloud
   *
   * RESPUESTA:
   * {
   *   "container": {
   *     "_id": "containerExample"
   *   }
   * }
   */
  router.delete('/containers/:container', function(req, res, next) { 
    var ctx = req._ctx;
    ctx.payload.name = req.params.container;
    ctx.model = "storage";
    ctx.method = 'deleteContainer';

    getFSInstance(ctx.resource).do(ctx)
      .then(resp => res.status(200).json(resp))
      .catch(next);
  }); //Probado local, gcloud, aws


  /**
   * Sube un archivo al contenedor especificado. Post en formato multipart
   * Para indicar otro servicio distinto de local pasar el parametro "service". Si no se especifica, el almacenamiento será local. (Ej. "service=gcloud")
   *
   * @name Upload file
   *
   * @route  {POST} srv/storage/containers/:container/upload
   *
   * @queryparam {String} [service]   Servicio de almacenamiento al que subir el archivo. (Ej. "service=gcloud")
   *
   * @routeparam {String} container   Nombre del contenedor al que subir el archivo
   * 
   * @bodyparam  {File}   fileUpload  Archivo que se va a subir
   * @bodyparam  {String} path        Path destino del archivo incluyendo el nombre y extension. Ejemplos: "filename.png", "subdir/filename.png"
   * 
   * @return {Object}  Informacion del archivo subido 
   *
   * @example: 
   *   UPLOAD: http://localhost:4999/api/v1/srv/storage/containers/containerExample/upload?service=gcloud
   *   DATOS multipart:
   *        - "path" : "file.png"
   *        - "fileUpload": El archivo a subir
   *   
   *   RESPUESTA: 
   *   {
   *     "file": {
   *       "_id": "file.png",
   *       "size": "131829",
   *       "path": "https://www.googleapis.com/download/storage/v1/b/containerExample/o/file.png?generation=1499774991897264&alt=media"
   *     }
   *   }
   *
   *   ----------------------------------------
   *
   *  UPLOAD: http://localhost:4999/api/v1/srv/storage/containers/containerExample/upload?service=gcloud
   *   DATOS multipart:
   *        - "path" : "subdir/file.png"
   *        - "fileUpload": El archivo a subir
   *   
   *   RESPUESTA: 
   *   {
   *     "file": {
   *       "_id": "subdir/file.png",
   *       "size": "131829",
   *       "path": "https://www.googleapis.com/download/storage/v1/b/containerExample/o/subdir%2Ffile.png?generation=1499774991897264&alt=media"
   *     }
   *   }
   *          
   */
  router.post("/containers/:container/upload",upload.single('fileUpload'),function(req, res, next){
    log.trace("entra en upload file");
    log.debug(req.file);
    log.debug(req.body.path);

    var ctx = req._ctx;
    ctx.payload.container = req.params.container;
    if(req.file)
      ctx.payload.file = req.file;
    ctx.payload.path = req.body.path;
    ctx.payload.body = req.body;
    log.debug(ctx.payload);
    ctx.model = "storage";
    ctx.method = 'uploadFile';
    
    getFSInstance(ctx.resource).do(ctx)
    .then(resp => res.status(200).json(resp))
      .catch(next);
  });  //Probado local, gcloud, aws


  /**
   * Elimina un archivo ya subido del contenedor indicado
   * Para indicar otro servicio distinto de local pasar el parametro "service". Si no se especifica, el almacenamiento será local. (Ej. "service=gcloud")
   *
   * @name Delete file
   *
   * @route  {DELETE} srv/storage/containers/:container/files/:file
   *
   * @queryparam {String} [service] Servicio de almacenamiento del que eliminar el archivo. (Ej. "service=gcloud")
   *
   * @routeparam {String} container   Nombre del contenedor del que eliminar el archivo
   * @routeparam {String} file        Nombre del archivo a eliminar
   * 
   * @return {Object} El archivo eliminado
   *
   * @example
   *   DELETE: http://localhost:4999/api/v1/srv/storage/containers/containerExample/files/subdir%2Ffile.png
   *
   *   RESPUESTA: 
   *    {
   *      "file": {
   *        "_id": "subdir/file.png"
   *      }
   *    }
   */
  router.delete('/containers/:container/files/:file', function(req, res, next) {
    var ctx = req._ctx;
    ctx.payload.container = req.params.container;
    ctx.payload.file = req.params.file;
    ctx.model = "storage";
    ctx.method = 'deleteFile';
    getFSInstance(ctx.resource).do(ctx)
      .then(resp => res.status(200).json(resp))
      .catch(next);
  }); //Probado local, gcloud, aws

  App.app.use(`${App.baseRoute}/srv/storage`, router);
}

module.exports = setupRoutes;