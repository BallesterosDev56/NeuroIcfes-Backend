# Configuración de Cloudinary para NeuroIcfes

Este documento explica cómo configurar Cloudinary para la carga de imágenes en NeuroIcfes.

## Requisitos

1. Una cuenta en Cloudinary (puedes registrarte gratis en [cloudinary.com](https://cloudinary.com/users/register/free))
2. Node.js y npm instalados

## Pasos para configurar

### 1. Obtener credenciales de Cloudinary

Después de registrarte en Cloudinary, ve al Dashboard y copia:

- Cloud Name
- API Key
- API Secret

### 2. Configurar variables de entorno

Añade las siguientes variables a tu archivo `.env`:

```
CLOUDINARY_CLOUD_NAME=tu_cloud_name
CLOUDINARY_API_KEY=tu_api_key
CLOUDINARY_API_SECRET=tu_api_secret
```

### 3. Crear directorio de subidas temporal

Asegúrate de crear un directorio `uploads` en la raíz del proyecto:

```bash
mkdir uploads
```

## Uso

El sistema ya está configurado para:

1. Permitir la carga de imágenes mediante el componente `ImageUploader` en el frontend
2. Almacenar las imágenes en Cloudinary
3. Guardar la URL y metadatos en la base de datos

## Estructura de archivos relevantes

- `src/config/cloudinary.js` - Configuración de Cloudinary
- `src/middleware/upload.js` - Middleware de Multer para manejar la carga de archivos
- `src/services/cloudinaryService.js` - Servicio para interactuar con Cloudinary
- `src/routes/upload.js` - Rutas API para carga de imágenes

## Limitaciones

- Tamaño máximo de archivo: 5MB
- Tipos de archivo permitidos: Imágenes (jpg, png, gif, etc.) 