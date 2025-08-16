// Utility para manejar rutas de imágenes de forma consistente
export const getImagePath = (imagePath) => {
  // En producción, las imágenes están en la raíz
  const baseUrl = import.meta.env.BASE_URL || '/';
  
  // Asegurar que la ruta empiece con /
  const cleanPath = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
  
  // Si baseUrl es '/', simplemente retornar la ruta limpia
  if (baseUrl === '/') {
    return cleanPath;
  }
  
  // En otros casos, combinar baseUrl con la ruta
  return `${baseUrl.replace(/\/$/, '')}${cleanPath}`;
};

// Exportar rutas comunes para facilitar el uso
export const IMAGES = {
  logo: getImagePath('/img/pandalogo.png'),
  cloud: getImagePath('/img/cloud.jpg'),
  formpanda: getImagePath('/img/formpanda.png'),
  pandapintando: getImagePath('/img/pandapintando.png'),
  pandadescansando: getImagePath('/img/pandadescansando.png'),
  footerimg: getImagePath('/img/footerimg.png'),
  perfil1: getImagePath('/img/perfil1.jpg'),
  perfil2: getImagePath('/img/perfil2.jpg'),
  perfil3: getImagePath('/img/perfil3.jpg'),
  pandazen_favicon: getImagePath('/img/pandazen_favicon.png'),
};
