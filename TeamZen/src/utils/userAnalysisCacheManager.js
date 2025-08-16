// Gestor de caché para análisis personales de MBI
import { supabase } from '../../supabaseClient';

/**
 * Genera un hash simple de los datos del usuario para detectar cambios
 */
function generateUserDataHash(userData) {
  const { mbiHistory, profile } = userData;
  
  const dataToHash = {
    // Datos del perfil relevantes para el análisis
    jobTitle: profile?.job_title,
    jobDescription: profile?.job_description,
    employmentType: profile?.employment_type,
    startDate: profile?.start_date,
    
    // Historial MBI resumido (ordenado por fecha para consistencia del hash)
    mbiSummary: mbiHistory
      ?.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)) // Ordenar por fecha
      ?.map(response => ({
        ae: response.mbi_scores?.ae_score,
        d: response.mbi_scores?.d_score,
        rp: response.mbi_scores?.rp_score,
        date: response.created_at ? new Date(response.created_at).toDateString() : null // Solo fecha, sin hora
        // REMOVIDO: teamId porque causa inconsistencias y no es relevante para análisis personal
      })) || []
  };
  
  // Generar hash simple (no criptográfico)
  const dataString = JSON.stringify(dataToHash);
  let hash = 0;
  for (let i = 0; i < dataString.length; i++) {
    const char = dataString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convertir a 32-bit integer
  }
  const finalHash = Math.abs(hash).toString(16);
  
  console.log('🔑 Generando hash para datos:', {
    profileKeys: Object.keys(dataToHash).filter(k => k !== 'mbiSummary'),
    mbiCount: dataToHash.mbiSummary.length,
    mbiSummary: dataToHash.mbiSummary, // Ver orden y contenido exacto
    dataStringLength: dataString.length,
    hash: finalHash
  });
  
  return finalHash;
}

/**
 * Obtiene análisis cacheado si está disponible y actualizado
 */
export async function getCachedUserAnalysis(userId, userData) {
  try {
    console.log('🔍 Buscando caché para usuario:', userId);
    const currentHash = generateUserDataHash(userData);
    console.log('🔑 Hash actual de datos:', currentHash);
    
    const { data: cached, error } = await supabase
      .from('user_mbi_analysis_cache')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (error) {
      console.log('ℹ️ No hay análisis cacheado disponible:', error.message);
      return null;
    }
    
    if (!cached) {
      console.log('ℹ️ No se encontró registro de caché');
      return null;
    }
    
    console.log('📋 Caché encontrado con hash:', cached.data_hash);
    
    // Verificar si el hash coincide (datos no han cambiado)
    if (cached.data_hash === currentHash) {
      console.log('✅ Hash coincide - usando análisis cacheado válido');
      return {
        ...cached.analysis_data,
        fromCache: true,
        cachedAt: cached.updated_at
      };
    }
    
    console.log('⚠️ Hash no coincide - se necesita nuevo análisis');
    console.log('  - Hash actual:', currentHash);
    console.log('  - Hash cacheado:', cached.data_hash);
    return null;
    
  } catch (error) {
    console.error('Error obteniendo análisis cacheado:', error);
    return null;
  }
}

/**
 * Guarda análisis en caché
 */
export async function saveUserAnalysisCache(userId, userData, analysisResult) {
  try {
    console.log('💾 Iniciando guardado en caché para usuario:', userId);
    const dataHash = generateUserDataHash(userData);
    console.log('🔑 Hash generado:', dataHash);
    
    const cacheData = {
      user_id: userId,
      data_hash: dataHash,
      analysis_data: {
        ...analysisResult,
        generatedAt: new Date().toISOString()
      },
      updated_at: new Date().toISOString()
    };
    
    console.log('📦 Datos a guardar en caché:', {
      user_id: cacheData.user_id,
      data_hash: cacheData.data_hash,
      analysis_data_keys: Object.keys(cacheData.analysis_data)
    });
    
    // Usar upsert para insertar o actualizar
    const { data, error } = await supabase
      .from('user_mbi_analysis_cache')
      .upsert(cacheData, { 
        onConflict: 'user_id',
        returning: 'minimal'
      });
    
    if (error) {
      console.error('❌ Error de Supabase al guardar caché:', error);
      throw error;
    }
    
    console.log('✅ Análisis guardado en caché exitosamente');
    return true;
    
  } catch (error) {
    console.error('❌ Error guardando análisis en caché:', error);
    console.error('📋 Detalles del error:', error.message);
    return false;
  }
}
