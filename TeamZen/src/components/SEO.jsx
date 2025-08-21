import React from 'react';
import { Helmet } from 'react-helmet-async';

const SEO = ({ 
  title = "TeamZen - Mide y reduce el burnout en tu equipo",
  description = "TeamZen ayuda a los equipos a medir y reducir el burnout usando el inventario MBI. Mejora el bienestar laboral y la productividad de tu equipo.",
  keywords = "burnout, bienestar laboral, MBI, equipos, productividad, salud mental, TeamZen",
  canonical = "https://teamzen.cl/",
  ogImage = "https://teamzen.cl/img/pandalogo.png",
  ogType = "website"
}) => {
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      <link rel="canonical" href={canonical} />
      
      {/* Open Graph */}
      <meta property="og:type" content={ogType} />
      <meta property="og:url" content={canonical} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={ogImage} />
      
      {/* Twitter */}
      <meta property="twitter:card" content="summary_large_image" />
      <meta property="twitter:url" content={canonical} />
      <meta property="twitter:title" content={title} />
      <meta property="twitter:description" content={description} />
      <meta property="twitter:image" content={ogImage} />
      
      {/* Structured Data */}
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebApplication",
          "name": "TeamZen",
          "description": description,
          "url": canonical,
          "applicationCategory": "BusinessApplication",
          "operatingSystem": "Web",
          "offers": {
            "@type": "Offer",
            "price": "0",
            "priceCurrency": "USD"
          }
        })}
      </script>
    </Helmet>
  );
};

export default SEO;