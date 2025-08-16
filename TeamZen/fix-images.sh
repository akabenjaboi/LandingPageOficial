#!/bin/bash
# Script para reemplazar todas las rutas de imágenes

# Buscar y reemplazar todas las ocurrencias de import.meta.env.BASE_URL con rutas directas
find src -name "*.jsx" -type f -exec sed -i 's|\${import\.meta\.env\.BASE_URL}/img/|/img/|g' {} \;

echo "✅ Todas las rutas de imágenes han sido actualizadas"
