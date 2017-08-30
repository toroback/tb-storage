# tb-storage


# Storage Reference

Este modulo permite manejar archivos (subir, bajar, obtener información ...) tanto en local con en algun servicio de almacenamiento de archivos como puede ser "Google Cloud".

## Configuración

Para utilizar almacenamiento local en el servidor no es necesario configurar ningun servicio adicional. Pero para utilizar un servicio externo para almacenar los datos lo primero que hay que hacer es configurarlo. Los servicios de almacenamiento externo son:
  * Google Cloud (gcloud)
  * Amazon AWS S3 (aws)

La configuracion de cualquier servicio se realizar en el archivo config.json que se encuentra en la carpeta "app".

 - Configuración de GCloud:

  * Desde a2server.a2system.net:

    En la aplicación seleccionada acceder a la sección "Configuración" y luego a la pestaña "Almacenamiento".

    Una vez en la pestaña en la sección de Google Cloud añadir el archivo keyFile.json pulsando el botón "Selecciona Google Cloud key" e introduce el id de proyecto GCloud.

  * Configuracion manual 

    Colocar el archivo keyFile.json en una carpeta llamada "cert" en la raiz del proyecto o en una subcarpeta de la misma.
      
      Ejemplo en cert: 
          root
            - a2s
            - app
            - cert
              - keyFile.json

      Ejemplo de subcarpeta:
          root
            - a2s
            - app
            - cert
              - gcloud
                - keyFile.json

    Una vez colocado el archivo keyFile.json hay que indicar su ubicacion en el archivo config.json e indicar el id de proyecto. Para ello tendríamos que añadir el objeto "storageOptions" al JSON de configuración si no existe, y completarlo de la siguiente manera:  

    ```
    "storageOptions": {
      "gcloud": {
       "projectId": <id del proyecto>,
        "keyFile": {
          "cert": < path a keyFile.json >
        }
      }
    },
    ```
    De esta manera, si el keyFile de gcloud se encuentre en el directorio "< raiz >/app/cert/gcloud" y el id de proyecto es "gcloudProyect" el objeto storageOptions quedará de la siguiente manera:

    ```
    "storageOptions": {
      "gcloud": {
       "projectId": "gcloudProyect",
        "keyFile": {
          "cert": "gcloud/keyFile.json"
        }
      }
    },
    ```

- Configuración de Amazon AWS S3:

  * Desde a2server.a2system.net:

    En la aplicación seleccionada acceder a la sección "Configuración" y luego a la pestaña "Almacenamiento".

    Una vez en la pestaña en la sección de Amazon AWS S3 es necesario introducir:
      - Access Key ID: Clave de acceso de Amazon.
      - Secret Acces Key: Clave secreta de Amazon.

  * Configuracion manual 

    La configuración se realiza en el archivo config.json. Para ello es necesario añadir el objeto "storageOptions" si no disponemos de él y luego agregar un objeto en él con la configuración para Amazon.

    El objeto de la configuración de Amazon tiene las siguientes propiedades:
    - "accessKeyId": Clave de acceso de Amazon.
    - "secretAccessKey": Clave secreta de Amazon.

    ```
    "aws":{
      "accessKeyId": "…",
      "secretAccessKey": "…"
    }
    ```

    Un ejemplo de configuración es:

    ```
    "storageOptions": {
      "aws":{
        "accessKeyId": "…",
        "secretAccessKey": "…"
      }
    },
    ```

## Uso

Para utilizar los servicios de almacenamiento se puede realizar de dos maneras:
  - Mediante llamadas internas al modelo (Servidor).
  - Mediante REST Api (Servidor o cliente).

### - **Llamadas internas**.

  Para realizar las llamadas internas se utiliza el objeto App.FileStorage. 

  Ejemplo:

  ```
  //ejemplo de almacenamiento en gcloud
  var Storage = new App.Storage("gcloud");
  Storage.getContainers().then(function(resp){
    console.log("Lista de containers:");
    console.log(resp);
  }).catch(function(err){
    console.log("error: "+err);
  })

  //ejemplo de almacenamiento local
  var Storage = new App.FileStorage("local",__dirname+"/../../log/");
    Storage.downloadFile({file:"test.log",res:res}).then(function(resp){
  }).catch(next);

  ```

### - **REST Api**.

  Las peticiones http se deben realizar a la url "https://[domain]:[port]/api/v[apiVersion]/srv/storage/"

  Las peticiones que se pueden realizar son:
  
  - Crear un nuevo contenedor:

    Realizar una peticion POST a https://[domain]:[port]/api/v[apiVersion]/srv/storage?service=< service >&container=< container >[&public=< true | false >]

    Parámetros:
      * "service": Servicio en el que se encontrará el contenedor
      * "container": Nombre del contenedor que se va a crear
      * "public": Flag que indica si el contenedor va a ser público. Por defecto es false.

    Ejemplo: 
    
    POST:  https://a2server.a2system.net:1234/api/v1/srv/storage?service=gcloud&container=my-container&public=true
      
    RESPUESTA:

    ```
    {
      "container": {
        "_id": "containerExample",
        "path": "https://www.googleapis.com/storage/v1/b/containerExample"
      }
    } 
    ```

  - Eliminar un contenedor :

    Realizar una peticion DELETE a https://[domain]:[port]/api/v[apiVersion]/srv/storage?service=< service >&container=< container >
  
    Ejemplo: 
      
    DELETE: https://a2server.a2system.net:1234/api/v1/srv/storage?service=gcloud&container=containerExample
   
    RESPUESTA:

    ```
    {
      "container": {
        "_id": "containerExample"
      }
    } 
    ```

  - Listar los contenedores existentes:

    Realizar una peticion GET a https://[domain]:[port]/api/v[apiVersion]/srv/storage?service=< service >
  
    Ejemplo: 
      
    GET: https://localhost:4999/storage?service=local  para los contenedores locales

    GET: https://localhost:4999/storage?service=gcloud  para los contenedores de gcloud
      

  - Subir un archivo a un contenedor:

    Realizar una peticion POST multipart a https://[domain]:[port]/api/v[apiVersion]/srv/storage/upload?service=< service >&container=< container >&public= < true | false >

    O se puede realizar mediante una referencia:

      POST multipart a https://[domain]:[port]/api/v[apiVersion]/srv/storage/upload?reference=< reference >&public= < true | false >


    Parámetros:

      * "service": Servicio al que se subira el archivo
      * "container": Nombre del contenedor al que se subira el archivo
      * "reference": Nombre de la referencia a la que se subira el archivo
      * "public": Flag que indica si el archivo va a ser público. Por defecto es false.

    Parámetros multipart:

      * "path": Path destino del archivo que se va a subir incluyendo el nombre y extensión del mismo.
      * "fileUpload": Archivo que se va a subir.
      

    Ejemplo: 

    UPLOAD: https://localhost:4999/storage/upload?service=gcloud&service=containerExample

    DATOS multipart:

    ```
     "path" : "file.png"
     "fileUpload": El archivo a subir
    ```

    RESPUESTA: 

    ```
     {
       "file": {
         "path": "file.png",
         "service": "gcloud",
         "container": "test-container",
         "public": true,
         "url": "https://www.googleapis.com/download/storage/v1/b/containerExample/o/file.png?generation=1504095147348420&alt=media"
       }
     }
    ```

  - Eliminar un archivo ya subido:

    Realizar una peticion DELETE a https://[domain]:[port]/api/v[apiVersion]/srv/storage?service=< service >&container=< container >&path=< path>

    O se puede realizar mediante una referencia:

      POST multipart a https://[domain]:[port]/api/v[apiVersion]/srv/storage?reference=< reference >&public= < true | false >&path=< path>

    Ejemplo: 
 
    DELETE: https://a2server.a2system.net:1234/api/v1/srv/storage?service=gcloud&container=containerExample&path=file.png
   
    RESPUESTA: 

    ```
     {
       "file": {
         "path": "file.png",
         "service": "gcloud",
         "container": "test-container",
         "public": true
       }
     }
    ```

  - Obtener los archivos de un contenedor:

    Realizar una peticion GET a https://[domain]:[port]/api/v[apiVersion]/srv/storage?service=< service >&container=< container >[&path=< subDir path >]

      O se puede realizar mediante una referencia:

      POST multipart a https://[domain]:[port]/api/v[apiVersion]/srv/storage?reference=< reference >[&path=< subDir path >]

    Ejemplo: 
      
    GET: https://a2server.a2system.net:1234/api/v1/srv/storage?service=gcloud&container=containerExample

    RESPUESTA:

    ```
     {
        "files": [
          {
            "path": "file.png",
            "service": "gcloud",
            "container": "test-container",
            "public": true,
            "url": "https://www.googleapis.com/download/storage/v1/b/containerExample/o/file.png?generation=1504095147348420&alt=media"
          }
        ]
     }
    ```

  - Obtener la información de un archivo dentro del contenedor:

    Realizar una peticion GET a https://[domain]:[port]/api/v[apiVersion]/srv/storage?service=< service >&container=< container >&path=< path >

      O se puede realizar mediante una referencia:

      POST multipart a https://[domain]:[port]/api/v[apiVersion]/srv/storage?reference=< reference >&path=< path >

    Ejemplo: 
     
    GET: https://a2server.a2system.net:1234/api/v1/srv/storage?service=gcloud&container=containerExample&path=file.jpg
       
    RESPUESTA:

    ```
    {
       "file": {
          "path": "file.png",
          "service": "gcloud",
          "container": "test-container",
          "public": true,
          "url": "https://www.googleapis.com/download/storage/v1/b/containerExample/o/file.png?generation=1504095147348420&alt=media"
        }
    }
    ```

  - Descargar un archivo subido:

    Realizar una peticion GET a https://[domain]:[port]/api/v[apiVersion]/srv/storage/download?service=< service >&container=< container >&path=< path >

     O se puede realizar mediante una referencia:

      POST multipart a https://[domain]:[port]/api/v[apiVersion]/srv/storage?reference=< reference >&path=< path >
      
    Ejemplo: 
      
    GET: https://a2server.a2system.net:1234/api/v1/srv/storage/download?service=gcloud&container=containerExample&path=file.png
           
    

