#**tb-storage Reference**

Este modulo permite almacenar archivos (subir, bajar, obtener información ...) tanto en local con en algun servicio de almacenamiento de archivos como puede ser "Google Cloud".


----------


## **Configuración**

Para utilizar almacenamiento local en el servidor no es necesario configurar ningún servicio adicional. Pero para utilizar un servicio externo de almacenamiento lo primero que hay que hacer es configurarlo. Los servicios de almacenamiento externo son:

  + Google Cloud (gcloud)
  + Amazon AWS S3 (aws)

La configuracion de cualquier servicio se realiza en el archivo config.json que se encuentra en la carpeta "app".

####**Configuración de GCloud:**

#####**- Desde la interfaz de administración A2Server:**
En la aplicación seleccionada acceder a la sección "Configuración" y luego a la pestaña "Almacenamiento".

Una vez en la pestaña en la sección de Google Cloud añadir el archivo keyFile.json pulsando el botón "Selecciona Google Cloud key" e introduce el id de proyecto GCloud.


#####**- Configuracion manual:**
Colocar el archivo keyFile.json en una carpeta llamada "cert" en la raiz del proyecto o en una subcarpeta de la misma.
      
- Ejemplo en cert: 
```
root/
  - a2s/
  - app/
  - cert/
    + keyFile.json
```

- Ejemplo de subcarpeta:
```
root/
  - a2s/
  - app/
  - cert/
    + gcloud/
      - keyFile.json
```

Una vez colocado el archivo keyFile.json hay que indicar su ubicación en el archivo config.json e indicar el id de proyecto. Para ello es necesario añadir el objeto "storageOptions" al JSON de configuración si no existe, y completarlo de la siguiente manera:  

```javascript
"storageOptions": {
   "gcloud": {
    "projectId": <id de proyecto>,
     "keyFile": {
       "cert": path/to/keyFile.json
     }
   }
 }
```

De esta manera, si el keyFile de gcloud se encuentre en el directorio "root/app/cert/gcloud" y el id de proyecto es "gcloudProyect" el objeto storageOptions quedará como en el siguiente ejemplo:

```
  "storageOptions": {
    "gcloud": {
     "projectId": "gcloudProyect",
      "keyFile": {
        "cert": "gcloud/keyFile.json"
      }
    }
  }
```

####**Configuración de Amazon AWS S3:**

#####**- Desde la interfaz de administración A2Server:**
En la aplicación seleccionada acceder a la sección "Configuración" y luego a la pestaña "Almacenamiento".

Una vez en la pestaña "Almacenamiento", en la sección de Amazon AWS S3 es necesario introducir:

  - Access Key ID: Clave de acceso de Amazon.
  - Secret Acces Key: Clave secreta de Amazon.

#####**- Configuracion manual:**
La configuración se realiza en el archivo config.json. Para ello es necesario añadir el objeto "storageOptions" si no disponemos de él y luego agregar un objeto en él con la configuración para Amazon.

El objeto de la configuración de Amazon tiene las siguientes propiedades:

  - "accessKeyId": Clave de acceso de Amazon.
  - "secretAccessKey": Clave secreta de Amazon.

Y su estructura es la siguiente:
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
    "accessKeyId": "AKIAXX4LE2R34WCKBCCC",
    "secretAccessKey": "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"
  }
}
```


----------


## **Modo de uso**

Los servicios de almacenamiento se pueden utilizar de dos maneras:

  - Mediante llamadas internas al modelo (Servidor):
  Utilizando las funcinoes de ***App.Storage***
    - Ejemplo:
    ```
    var service = "local"; // Servicio de almacenamiento
    var Storage = new App.Storage(service);
    ```

  - Mediante REST Api (Servidor o cliente):
  Realizando peticiones a los servicios de storage con el siguiente formato de URL
    - https://[domain]:[port]/api/v[apiVersion]/srv/storage/
  


----------


## **Funcionalidades**
A continuación se detallarán las funcionalidades de las que dispone el módulo.

###  **- Crear un nuevo contenedor:**

- **Petición REST:**
  
  - HTTP Method: 
    POST
    
  - URL: 
`https://[domain]:[port]/api/v[apiVersion]/srv/storage?service=<service>&container=<container>[&public=<true|false>]`

  - Parámetros del query:
    | Clave | Tipo | Opcional   | Descripción  |
    |---|---|:---:|---|
    | service  |  String  |   | Servicio de almacenamiento (valores: local, gcloud, aws)  |
    | container  | String  |   | Nombre del contenedor que se va a crear  |
    | public  | Boolean  | X  | Flag que indica si el contenedor va a ser público. Por defecto es false.  |

  - Respuesta:
    | Clave | Tipo | Opcional | Descripción |
    |---|---|:---:|---|
    |container|Object||Objeto con la información del contenedor creado| 
    |container._id|String||Identificador del contenedor| 
    |container.path|String|X|Url del contenedor creado. Sólo si es público|    

  - Ejemplo: 
      - Petición:
     ```
      POST:  https://a2server.a2system.net:1234/api/v1/srv/storage?service=gcloud&container=containerExample&public=true
     ```
     
     - Respuesta:
    ```
     {
       "container": {
         "_id": "containerExample",
         "path": "https://www.googleapis.com/storage/v1/b/containerExample"
       }
     } 
    ```
    
-  **Código Javascript:**
    - Parámetros:
    | Clave | Tipo | Opcional   | Descripción  |
    |---|---|:---:|---|
    |args|Object||| 
    |args.container|String||Nombre del contenedor que se va a crear| 
    |args.public|Boolean|X|Flag que indica si el contenedor va a ser público. Por defecto es false.| 

    - Respuesta:
    | Clave | Tipo | Opcional   | Descripción  |
    |---|---|:---:|---|
    |container|Object||Objeto con la información del contenedor creado| 
    |container._id|String||Identificador del contenedor| 
    |container.path|String|X|Url del contenedor creado. Sólo si es público| 
    
    - Ejemplo:
    
      - Petición
      
      ```javascript
      var service = "gcloud";
      var args = {
        container : "containerExample"
      };
    
      var Storage = new App.Storage(service);
      Storage.createContainer(args) 
        .then(res => {})
        .catch(err => {});
      ```


     - Respuesta:
  
      ```
      {
        "container": {
          "_id": "containerExample",
          "path": "https://www.googleapis.com/storage/v1/b/containerExample"
        }
      } 
      ```

###  **- Eliminar un contenedor:**

-  **Petición REST:**
  - HTTP Method: 
    DELETE
    
  - URL: 
  `https://[domain]:[port]/api/v[apiVersion]/srv/storage?service=<service>&container=<container>&force=<force>`

  Parámetros del query:
    service:    String.   Servicio de almacenamiento (valores: local, gcloud, aws)
    container:  String.   Nombre del contenedor que se va a crear
    force:      Boolean.  Flag que fuerza la eliminacion aunque tenga archivos almacenados

  Respuesta:
    container:        Object.    Objeto con la información del contenedor eliminado
    container._id:    String.    Identificador del contenedor
  
  Ejemplo: 
  
  DELETE:  https://a2server.a2system.net:1234/api/v1/srv/storage?service=gcloud&container=containerExample
    
  RESPUESTA:

  ```javascript
  {
    "container": {
      "_id": "containerExample"
    }
  }
  ```

-  **Código Javascript:**
  
  Parámetros:
    args:            Object.   
    args.container:  String.     Nombre del contenedor que se va a eliminar
    args.force:      Boolean.    Flag que fuerza la eliminacion aunque tenga archivos almacenados

  ```javascript
  var service = "gcloud";
  var args = {
    container : "containerExample"
  };

  var Storage = new App.Storage(service);
  Storage.deleteContainer(args) 
    .then(res => {})
    .catch(err => {});
  ```


  RESPUESTA:

  ```javascript
  {
    "container": {
      "_id": "containerExample"
    }
  }
  ```

###  **- Listar los contenedores existentes:**
  
  Devuelve los contenedores que hay creados en el servicio indicado

-  **Petición REST:**
  - HTTP Method: 
    GET
    
  - URL: 
  `https://[domain]:[port]/api/v[apiVersion]/srv/storage?service=<service>`


  Parámetros del query:
    service:    String.   Servicio de almacenamiento (valores: local, gcloud, aws)

  Respuesta:
    containers:        Array.              Array con los contenedores
    containers._id:    String.             Identificador del contenedor
    containers.path:   String. Opcional.   Url del contenedor creado
  
  Ejemplo: 
  
  GET:  https://a2server.a2system.net:1234/api/v1/srv/storage?service=gcloud
    
  RESPUESTA:

  ```
  {
    "containers": [
      {
        "_id": "containerExample",
        "path": "https://www.googleapis.com/storage/v1/b/containerExample"
      }
    ]
  }
  ```

-  **Código Javascript:**
  
  ```
  var service = "gcloud";

  var Storage = new App.Storage(service);
  Storage.getContainers() 
    .then(res => {})
    .catch(err => {});
  ```


  RESPUESTA:

  ```
  {
    "containers": [
      {
        "_id": "containerExample",
        "path": "https://www.googleapis.com/storage/v1/b/containerExample"
      }
    ]
  }
  ```

###  **- Subir un archivo:**

-  **Petición REST:**
  - HTTP Method: 
    POST Multipart
    
  - URL: 
  `https://[domain]:[port]/api/v[apiVersion]/srv/storage/upload?service=<service>&container=<container>[&reference=<reference>]&public=<true|false>[&arg=<arg>]`

  - Parámetros del query:

  service:    String. Opcional.  Servicio de almacenamiento (valores: local, gcloud, aws)
  container:  String. Opcional.  Nombre del contenedor que se va a crear
  reference:  String. Opcional.  Referencia a una ubicación. (Para más información ver "Uso de Referencias")
  arg:        String. Opcional.  Componente de ruta en la que se ubicará el subpath si reference = 'temporal'.(Ej. reference = "temporal", arg = "argDir" => argDir/tmp/subpath ).
  public:     Boolean. Opcional. Flag que indica si el contenedor va a ser público. Por defecto es false.

  - Parámetros Multipart:

  path:       String. Path destino relativo al contenedor del archivo que se va a subir incluyendo el nombre y extensión del mismo.
  fileUpload: File.   Archivo que se va a subir.

  NOTA: Es necesario pasar una de las dos opciones. Servicio y contenedor ó refencia.

  - Respuesta:

  file:           Object.             Objeto con la información del archivo subido
  file.path:      String.             Path del archivo relativo al contenedor
  file.service:   String. Opcional.   Servicio al que se subió el archivo. Sólo si la consulta se realizó con servicio, no con referencia.
  file.container: String. Opcional.   Contenedor al que se subió el archivo. Sólo si la consulta se realizó con container, no con referencia.
  file.reference: String. Opcional.   Referencia a la que se subió el archivo. Sólo si la consulta se realizó con referencia, no con servicio y contenedor.
  file.public:    Boolean. Opcional.  Indica si el archivo es público o no.
  file.url:       String. Opcional.   Url del archivo subido, sólo si el archivo es público

  - Ejemplo: 

    * POST: 
    `https://a2server.a2system.net:1234/api/v1/srv/storage/upload?service=gcloud&container=containerExample`

    * DATOS multipart:

    ```
     "path" : "file.png"
     "fileUpload": El archivo a subir
    ```

    * RESPUESTA: 

    ```
     {
       "file": {
         "path": "file.png",
         "service": "gcloud",
         "container": "containerExample",
         "public": true,
         "url": "https://www.googleapis.com/download/storage/v1/b/containerExample/o/file.png?generation=1504095147348420&alt=media"
       }
     }
    ```

-  **Código Javascript:**
  Para subir un archivo desde el propio servidor los parámetros varían a la manera de realizarlo a través de una petición rest.

  Para más información sobre el uso de referencias ver "Uso de Referencias".

  - Parámetros:

    payload:           Object. Objeto payload que recibe el metodo
    payload.container: String. Nombre del contenedor donde sera guardado el archivo
    payload.path:      String. Path en el que se guardará el archivo (formato test/test1/text.txt)
    payload.file:      File.   Objeto que representa al archivo que se va a subir
    payload.public:    Boolean. Opcional.  Indica si el archivo es público o no.

  - Respuesta:

    file:           Object.             Objeto con la información del archivo subido
    file.path:      String.             Path del archivo relativo al contenedor
    file.service:   String. Opcional.   Servicio al que se subió el archivo. Sólo si la consulta se realizó con servicio, no con referencia.
    file.container: String. Opcional.   Contenedor al que se subió el archivo. Sólo si la consulta se realizó con container, no con referencia.
    file.reference: String. Opcional.   Referencia a la que se subió el archivo. Sólo si la consulta se realizó con referencia, no con servicio y contenedor.
    file.public:    Boolean. Opcional.  Indica si el archivo es público o no.
    file.url:       String. Opcional.   Url del archivo subido, sólo si el archivo es público

  - Ejemplo:

    * Código
  
    ```
    var service = "gcloud";
    var payload = {
      container: "containerExample",
      path: "file.png",
      file: myFileToUpload,
      public: true
    }
    var Storage = new App.Storage(service);
    Storage.uploadFile(payload) 
      .then(res => {})
      .catch(err => {});
    ```  

    * Respuesta
  
    ```
     {
       "file": {
         "path": "file.png",
         "service": "gcloud",
         "container": "containerExample",
         "public": true,
         "url": "https://www.googleapis.com/download/storage/v1/b/containerExample/o/file.png?generation=1504095147348420&alt=media"
       }
     }
    ```

###  **- Eliminar un archivo:**
Para eliminar un archivo hay que indicar la ubicación de dicho archivo y su nombre. Para ello basta con indicar el servicio en el que se aloja, su contenedor y su path. 

En este caso el path debe representar un archivo, no una carpeta. (Ej. path/to/file.png)

A continuación veremos cómo se hace a través de una petición REST y cómo a través de código Javascript.

-  **Petición REST:**
Un archivo se puede eliminar a través del servicio y contenedor ó se puede realizar mediante una referencia

  - HTTP Method: 
    DELETE
    
  - URL: 
  `https://[domain]:[port]/api/v[apiVersion]/srv/storage?service=<service>&container=<container>&path=<path>[&reference=<reference>] `

  - Parámetros del query:

  service:    String. Opcional.  Servicio de almacenamiento (valores: local, gcloud, aws)
  container:  String. Opcional.  Nombre del contenedor del que se va a leiminar el archivo.
  reference:  String. Opcional.  Referencia a una ubicación. (Para más información ver "Uso de Referencias")
  path:       String.            Path del archivo relativo al contenedor.

  - Respuesta:

  file:           Object.             Objeto con la información del archivo subido
  file.path:      String.             Path del archivo relativo al contenedor
  file.service:   String. Opcional.   Servicio donde estaba el archivo. Sólo si la consulta se realizó con servicio, no con referencia.
  file.container: String. Opcional.   Contenedor en el que estaba el archivo. Sólo si la consulta se realizó con container, no con referencia.
  file.reference: String. Opcional.   Referencia en la que estaba el archivo. Sólo si la consulta se realizó con referencia, no con servicio y contenedor.
  file.public:    Boolean. Opcional.  Indica si el archivo era público o no.

  - Ejemplo: 

    * DELETE:
    `https://a2server.a2system.net:1234/api/v1/srv/storage?service=gcloud&container=containerExample&path=file.png`

    * RESPUESTA: 
  
    ```javascript
     {
       "file": {
         "path": "file.png",
         "service": "gcloud",
         "container": "containerExample",
         "public": true
       }
     }
    ```

-  **Código Javascript:**

Para eliminar un archivo desde el propio servidor los parámetros varían a la manera de realizarlo a través de una petición REST.

> Para más información sobre el uso de referencias ver "Uso de Referencias".

- Parámetros:

  payload:           Object. Objeto payload que recibe el metodo
  payload.container: String. Nombre del contenedor donde se encuentra el archivo
  payload.path:      String. Path relativo al contenedor en el que se encuentra el archivo (formato test/test1/text.txt)

- Respuesta:

  file:           Object.             Objeto con la información del archivo subido
  file.path:      String.             Path del archivo relativo al contenedor
  file.service:   String. Opcional.   Servicio donde estaba el archivo. Sólo si la consulta se realizó con servicio, no con referencia.
  file.container: String. Opcional.   Contenedor en el que estaba el archivo. Sólo si la consulta se realizó con container, no con referencia.
  file.reference: String. Opcional.   Referencia en la que estaba el archivo. Sólo si la consulta se realizó con referencia, no con servicio y contenedor.
  file.public:    Boolean. Opcional.  Indica si el archivo era público o no.


- Ejemplo:

  * Código

  ```
  var service = "gcloud";
  var payload = {
    container: "containerExample",
    path: "file.png"
  }
  var Storage = new App.Storage(service);
  Storage.deleteFile(payload) 
    .then(res => {})
    .catch(err => {});
  ```  

  * Respuesta

  ```
   {
     "file": {
       "path": "file.png",
       "service": "gcloud",
       "container": "containerExample",
       "public": true
     }
   }
  ```
  
###  **- Obtener los archivos de un contenedor:**

Para obtener los archivos de un contenedor hay que indicar la ubicación de dichos archivos y un subpath si se quiere obtener de una subcarpeta. Para ello basta con indicar el servicio en el que se aloja, su contenedor y su path. 

En este caso el path no debe representar una archivo, sino una carpeta. (Ej. path/to/dir/)

A continuación veremos cómo se hace a través de una petición REST y cómo a través de código Javascript.

-  **Petición REST:**

Los archivos se pueden obtener a través del servicio y contenedor ó mediante una referencia

GET a https://[domain]:[port]/api/v[apiVersion]/srv/storage?service=< service >&container=< container >[&path=< dir path >][&reference=< reference >] 

- Parámetros del query:

  service:    String. Opcional.  Servicio de almacenamiento (valores: local, gcloud, aws)
  container:  String. Opcional.  Nombre del contenedor que se va a crear
  reference:  String. Opcional.  Referencia a una ubicación. (Para más información ver "Uso de Referencias")
  path:       String.            Path del archivo relativo al contenedor.

- Respuesta:

  files:           Array.              Array con los archivos del contendor
  files.path:      String.             Path del archivo relativo al contenedor
  files.service:   String. Opcional.   Servicio donde esta el archivo. Sólo si la consulta se realizó con servicio, no con referencia.
  files.container: String. Opcional.   Contenedor en el que esta el archivo. Sólo si la consulta se realizó con container, no con referencia.
  files.reference: String. Opcional.   Referencia en la que esta el archivo. Sólo si la consulta se realizó con referencia, no con servicio y contenedor.
  files.public:    Boolean. Opcional.  Indica si el archivo es público o no.

- Ejemplo: 

  * GET: https://a2server.a2system.net:1234/api/v1/srv/storage?service=gcloud&container=containerExample&path=subdir/

  * RESPUESTA: 

  ```
   {
     "files": [
       {
         "path": "subdir/file.png",
         "service": "gcloud",
         "container": "containerExample",
         "public": false
       }
     ]
   }
  ```

-  **Código Javascript:**

Para obtener los archivos de un contenedor desde el propio servidor los parámetros varían a la manera de realizarlo a través de una petición REST.

Para más información sobre el uso de referencias ver "Uso de Referencias".

- Parámetros:

  payload:           Object. Objeto payload que recibe el metodo
  payload.container: String. Nombre del contenedor donde se encuentra el archivo
  payload.path:      String. Path relativo al contenedor en el que se encuentra el archivo (formato test/test1/)

- Respuesta:

  files:           Array.              Array con los archivos del contendor
  files.path:      String.             Path del archivo relativo al contenedor
  files.service:   String. Opcional.   Servicio donde esta el archivo. Sólo si la consulta se realizó con servicio, no con referencia.
  files.container: String. Opcional.   Contenedor en el que esta el archivo. Sólo si la consulta se realizó con container, no con referencia.
  files.reference: String. Opcional.   Referencia en la que esta el archivo. Sólo si la consulta se realizó con referencia, no con servicio y contenedor.
  files.public:    Boolean. Opcional.  Indica si el archivo es público o no.


- Ejemplo:

  * Código

  ```
  var service = "gcloud";
  var payload = {
    container: "containerExample",
    path: "subdir/"
  }
  var Storage = new App.Storage(service);
  Storage.getFiles(payload) 
    .then(res => {})
    .catch(err => {});
  ```  

  * Respuesta

  ```
   {
     "files": [
       {
         "path": "subdir/file.png",
         "service": "gcloud",
         "container": "containerExample",
         "public": false
       }
     ]
   }
  ```

###  **- Obtener la información de un archivo:**

Para obtener la información de un archivo hay que indicar su ubicación. Para ello basta con indicar el servicio en el que se aloja, su contenedor y su path. 

En este caso el path debe representar un archivo, no una carpeta. (Ej. path/to/dir/file.png)

A continuación veremos cómo se hace a través de una petición REST y cómo a través de código Javascript.

-  **Petición REST:**

La información del archivo se puede obtener a través del servicio y contenedor ó mediante una referencia

GET a https://[domain]:[port]/api/v[apiVersion]/srv/storage?service=< service >&container=< container >[&path=< path>][&reference=< reference >] 

- Parámetros del query:

  service:    String. Opcional.  Servicio de almacenamiento (valores: local, gcloud, aws)
  container:  String. Opcional.  Nombre del contenedor que se va a crear
  reference:  String. Opcional.  Referencia a una ubicación. (Para más información ver "Uso de Referencias")
  path:       String.            Path del archivo relativo al contenedor.

- Respuesta:

  file:           Object.             Objeto con la informacion del archivo
  file.path:      String.             Path del archivo relativo al contenedor
  file.service:   String. Opcional.   Servicio donde esta el archivo. Sólo si la consulta se realizó con servicio, no con referencia.
  file.container: String. Opcional.   Contenedor en el que esta el archivo. Sólo si la consulta se realizó con container, no con referencia.
  file.reference: String. Opcional.   Referencia en la que esta el archivo. Sólo si la consulta se realizó con referencia, no con servicio y contenedor.
  file.public:    Boolean. Opcional.  Indica si el archivo es público o no.

- Ejemplo: 

  * GET: https://a2server.a2system.net:1234/api/v1/srv/storage?service=gcloud&container=containerExample&path=subdir/file.png

  * RESPUESTA: 

  ```
   {
     "file": {
       "path": "subdir/file.png",
       "service": "gcloud",
       "container": "containerExample",
       "public": false
     }
   }
  ```

-  **Código Javascript:**

Para obtener la información de un archivo desde el propio servidor los parámetros varían a la manera de realizarlo a través de una petición REST.

Para más información sobre el uso de referencias ver "Uso de Referencias".

- Parámetros:

  payload:           Object. Objeto payload que recibe el metodo
  payload.container: String. Nombre del contenedor donde se encuentra el archivo
  payload.path:      String. Path relativo al contenedor en el que se encuentra el archivo (formato test/test1/file.png)

- Respuesta:

  file:           Object.             Objeto con la informacion del archivo
  file.path:      String.             Path del archivo relativo al contenedor
  file.service:   String. Opcional.   Servicio donde esta el archivo. Sólo si la consulta se realizó con servicio, no con referencia.
  file.container: String. Opcional.   Contenedor en el que esta el archivo. Sólo si la consulta se realizó con container, no con referencia.
  file.reference: String. Opcional.   Referencia en la que esta el archivo. Sólo si la consulta se realizó con referencia, no con servicio y contenedor.
  file.public:    Boolean. Opcional.  Indica si el archivo es público o no.


- Ejemplo:

  * Código

  ```
  var service = "gcloud";
  var payload = {
    container: "containerExample",
    path: "subdir/file.png"
  }
  var Storage = new App.Storage(service);
  Storage.getFileInfo(payload) 
    .then(res => {})
    .catch(err => {});
  ```  

  * Respuesta

  ```
   {
     "file": {
       "path": "subdir/file.png",
       "service": "gcloud",
       "container": "containerExample",
       "public": false
     }
   }
  ```
  
###  **- Descargar un archivo:**

Para descargar un archivo hay que indicar su ubicación. Para ello basta con indicar el servicio en el que se aloja, su contenedor y su path. 

En este caso el path debe representar una archivo, no una carpeta. (Ej. path/to/dir/file.png)

A continuación veremos cómo se hace a través de una petición REST y cómo a través de código Javascript.

-  **Petición REST:**

El archivo se puede descargar a través del servicio y contenedor ó mediante una referencia

GET a https://[domain]:[port]/api/v[apiVersion]/srv/storage/download?service=< service >&container=< container >[&path=< path>][&reference=< reference >] 

- Parámetros del query:

  service:    String. Opcional.  Servicio de almacenamiento (valores: local, gcloud, aws)
  container:  String. Opcional.  Nombre del contenedor que se va a crear
  reference:  String. Opcional.  Referencia a una ubicación. (Para más información ver "Uso de Referencias")
  path:       String.            Path del archivo relativo al contenedor.

- Respuesta:

  Se descarga el archivo

- Ejemplo: 

  * GET: https://a2server.a2system.net:1234/api/v1/srv/storage/download?service=gcloud&container=containerExample&path=subdir/file.png

-  **Código Javascript:**

Para descargar un archivo desde el propio servidor los parámetros varían a la manera de realizarlo a través de una petición REST.

Para más información sobre el uso de referencias ver "Uso de Referencias".

- Parámetros:

  payload:           Object.          Objeto payload que recibe el metodo
  payload.container: String.          Nombre del contenedor donde se encuentra el archivo
  payload.path:      String.          Path relativo al contenedor en el que se encuentra el archivo (formato test/test1/file.png)
  payload.res:       Stream.Writable  Flujo por le que enviar el archivo que se va a descargar 

- Ejemplo:

  * Código

  ```
  var service = "gcloud";
  var outputStream = ...;
  var payload = {
    container: "containerExample",
    path: "subdir/file.png"
    res: outputStream
  }
  var Storage = new App.Storage(service);
  Storage.downloadFile(payload) 
    .then(res => {})
    .catch(err => {});
  ```  

###  **- Cambiar privacidad de un archivo:**

IMPORTANTE: El cambio de privacidad no está disponible para el servicio de almacenamiento Local

Para cambiar la privacidad de un archivo hay que indicar la ubicación y path del mismo. Para ello basta con indicar el servicio en el que se aloja, su contenedor y su path. 

En este caso el path debe representar un archivo, no una carpeta. (Ej. path/to/file.png)

A continuación veremos cómo se hace a través de una petición REST y cómo a través de código Javascript.

-  **Petición REST:**

La privacidad de un archivo se puede realizar a través del servicio y contenedor ó se puede realizar mediante una referencia

POST a https://[domain]:[port]/api/v[apiVersion]/srv/storage/public?service=< service >&container=< container >&path=< path>[&reference=< reference >] 

- Parámetros del query:

  service:    String. Opcional.  Servicio de almacenamiento (valores: local, gcloud, aws)
  container:  String. Opcional.  Nombre del contenedor del que se van a eliminar los archivos.
  reference:  String. Opcional.  Referencia a una ubicación. (Para más información ver "Uso de Referencias")
  path:       String.            Path del archivo relativo al contenedor.
  public:     Boolean.           Indica si la privacidad será publica (true) o privada (false)

- Respuesta:

  file:           Object.             Objeto con la información del archivo subido
  file.path:      String.             Path del archivo relativo al contenedor
  file.service:   String. Opcional.   Servicio donde esta el archivo. Sólo si la consulta se realizó con servicio, no con referencia.
  file.container: String. Opcional.   Contenedor en el que esta el archivo. Sólo si la consulta se realizó con container, no con referencia.
  file.reference: String. Opcional.   Referencia en la que esta el archivo. Sólo si la consulta se realizó con referencia, no con servicio y contenedor.
  file.public:    Boolean. Opcional.  Indica si el archivo es público o no.

- Ejemplo: 

  * POST: https://a2server.a2system.net:1234/api/v1/srv/storage/public?service=gcloud&container=containerExample&path=file.png&public=false

  * RESPUESTA: 

  ```
   {
     "file": {
       "path": "file.png",
       "service": "gcloud",
       "container": "containerExample",
       "public": false
     }
   }
  ```

-  **Código Javascript:**

Para eliminar un archivo desde el propio servidor los parámetros varían a la manera de realizarlo a través de una petición REST.

Para más información sobre el uso de referencias ver "Uso de Referencias".

- Parámetros:

  payload:           Object.  Objeto payload que recibe el metodo
  payload.container: String.  Nombre del contenedor donde se encuentra el archivo
  payload.path:      String.  Path relativo al contenedor en el que se encuentra el archivo (formato test/test1/text.txt)
  payload.public:    Boolean. Indica si la privacidad será publica (true) o privada (false)

- Respuesta:

  file:           Object.             Objeto con la información del archivo subido
  file.path:      String.             Path del archivo relativo al contenedor
  file.service:   String. Opcional.   Servicio donde esta el archivo. Sólo si la consulta se realizó con servicio, no con referencia.
  file.container: String. Opcional.   Contenedor en el que esta el archivo. Sólo si la consulta se realizó con container, no con referencia.
  file.reference: String. Opcional.   Referencia en la que esta el archivo. Sólo si la consulta se realizó con referencia, no con servicio y contenedor.
  file.public:    Boolean. Opcional.  Indica si el archivo es público o no.


- Ejemplo:

  * Código

  ```
  var service = "gcloud";
  var payload = {
    container: "containerExample",
    path: "file.png",
    public: false
  }
  var Storage = new App.Storage(service);
  Storage.makeFilePublic(payload) 
    .then(res => {})
    .catch(err => {});
  ```  

  * Respuesta

  ```
   {
     "file": {
       "path": "file.png",
       "service": "gcloud",
       "container": "containerExample",
       "public": false
     }
   }
  ```

###  **- Obtener token de acceso:**

En ocaciones, para poder visualizar u obtener archivos privados almacenados en un servicio es necesario utilizar un token de acceso a él.

Para conseguir un access token hay que indicar el servicio para el que se desea obtener y el tiempo minimo de duracion requerido. Por ahora el máximo es de 1 hora.

A continuación veremos cómo se hace a través de una petición REST y cómo a través de código Javascript.

-  **Petición REST:**

GET a https://[domain]:[port]/api/v[apiVersion]/srv/storage/get-token?service=< service >&mintime=< mintime >

- Parámetros del query:

  service:    String.            Servicio de almacenamiento (valores: local, gcloud, aws)
  mintime:    Number. Opcional.  Duracion minima que debe tener el token. Como máximo el token puede ser de una hora.

- Respuesta:

  token:           String.       Token generado
  expires_at:      Date.         Fecha de expiración del token

- Ejemplo: 

  * GET: https://a2server.a2system.net:1234/api/v1/srv/get-token?service=gcloud

  * RESPUESTA: 

  ```
    {
      "token": "ya29.ElrpBDvRlm4WfQTIZ6DUcMrggYxcz9WHWkyoCDpFtTnbPgRG87r6uWXDxLPJtz6VuiHEM8265Yc6ha_gLv1dvLXxzBetkPW-NyPv-ZVgaSjVuGcvknn6Hi3xXXx",
      "expires_at": "2017-10-19T15:22:00.000Z"
    }
  ```

-  **Código Javascript:**

- Parámetros:

  service:      String.            Servicio de almacenamiento (valores: local, gcloud, aws)
  mintime:      Number. Opcional.  Duracion minima que debe tener el token. Como máximo el token puede ser de una hora.
  credentials:  Object. Opcional.  Objeto que contiene las credenciales necesarias para el servicio indicado. Por defecto toma las configuradas en el archivo config.json

- Ejemplo:

  * Código

  ```
  var service = "gcloud";
  var minTime = 1000; // en segundos

  App.Storage.genToken(service, minTime) 
    .then(res => {})
    .catch(err => {});
  ```  

  * RESPUESTA: 

  ```
    {
      "token": "ya29.ElrpBDvRlm4WfQTIZ6DUcMrggYxcz9WHWkyoCDpFtTnbPgRG87r6uWXDxLPJtz6VuiHEM8265Yc6ha_gLv1dvLXxzBetkPW-NyPv-ZVgaSjVuGcvknn6Hi3xXXx",
      "expires_at": "2017-10-19T15:22:00.000Z"
    }
  ```



## **Uso de referencia**
Una referencia es una manera de identificar un punto de almacenamiento.
Dicho punto de almacenamiento estará formado por:
  - Un servicio.
  - Un contenedor.
  - Un path opcional.

De esta manera, utilizando una referencia, no es necesario conocer los detalles de la ubicación en la que se almacenaran los archivos desde los distintos clientes. 

Para utilizar referencias primero hay que registrar las distintas referencias que se vayan a utilizar desde el servidor y luego realizar las peticiones, que soporten paso de referencias, con la referencia desesada.


Un posible escenario de uso de referencias es el siguiente:

Supongamos que nuestro servidor ofrece almacenamiento de imágenes de perfil de usuarios en GCloud en un contendor que se llama users_pictures en una carpeta llamada "profile". Con lo que tendríamos:
  - Servicio : GCloud
  - Contenedor : users_pictures
  - Path : "profile/"

Si creamos una referencia podemos asociar directamente esta ubicación. Su nombre podría ser, por ejemplo, user_profile_pictures.

### **Regitrar referencias**

Para registrar una referencia hay que crear un objeto con los siguientes valores:

  service: String. El servicio de almacenamiento
  container: String. El contenedor donde se almacenaran los archivos
  pathPrefix: String. Un subpath relativo al contenedor

Y luego establecerla.

- Ejemplo:
  
  En el archivo boot.js
  
  ```
  function Boot(){
    …

    var references = {};

    var userPicturesRef = {
      service: "gcloud",
      container: "users_pictures",
      pathPrefix: "profile/"
    }
    references.user_profile_pictures = userPicturesRef;

    App.Storage.setReferences(references);
  }
  ```


### **Convertir ubicacion con referencia a ubicacion con servicio**

Si necesitamos trabajar con referencias desde nuestro servidor tendremos que transformar una ubicación con referencia a una ubicación con servicio. Esto es, obtener el servicio, contendor y subpath para una referencia.

Esto se puede realizar con la funcion "toServiceObject(referenceObject)" de Storage.

El parámetro de entrada es un objeto que contiene el nombre de la referencia y un path opcional relativo a la referencia.

- Ejemplo

  ```
  var referenceObject = {
    reference: "user_profile_pictures",
    path: "path/from/reference"
  }

  var serviceObject = App.Storage.toServiceObject(referenceObject);

  console.log(serviceObject);

  //{
  //  service:gcloud,
  //  container: "users_pictures",
  //  pathPrefix: "profile/path/from/reference" 
  //}
  ```


Importante ver que el pathPrefix original era "profile/", pero como se pasó un path en el referenceObject, éste se añade al original para trabajar con él.


Luego, si estamos trabajando con servicio y contenedor y necesitamos trabajar con referencia, se puede convertir una ubicación con servicio a una ubicación  con referencia.

- Ejemplo

  ```
  var serviceObject = {
    service:gcloud,
    container: "users_pictures",
    pathPrefix: "profile/path/from/reference" 
  }

  var referenceObject = App.Storage.toReferenceObject(serviceObject);

  console.log(referenceObject);

  //{
  //  reference: "user_profile_pictures",
  //  path: "path/from/reference" 
  //}
  ```



