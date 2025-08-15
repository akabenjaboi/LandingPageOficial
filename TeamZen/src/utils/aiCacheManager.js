// Utilidades para cache de análisis de IA
import { supabase } from '../../supabaseClient';

/**
 * Genera un hash simple de los datos MBI para detectar cambios
 */
function generateDataHash(mbiData) {
  const { ae, d, rp, wellbeing, teamContext, history } = mbiData;
  const dataString = JSON.stringify({
    ae, d, rp, wellbeing, 
    teamName: teamContext?.name,
    teamDesc: teamContext?.description,
    historyLength: history?.length || 0,
    // Solo incluir fechas de history para detectar cambios estructurales
    historyDates: history?.map(h => h.date) || []
  });
  
  // Hash simple (no necesitamos criptografía robusta)
  let hash = 0;
  for (let i = 0; i < dataString.length; i++) {
    const char = dataString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convertir a 32-bit integer
  }
  return hash.toString();
}

/**
 * Busca análisis de IA en cache
 * @param {string} teamId - ID del equipo
 * @param {string} cycleId - ID del ciclo actual
 * @param {object} mbiData - Datos MBI para verificar si cambió
 * @returns {object|null} - Análisis cacheado o null si no existe/expiró
 */
export async function getCachedAnalysis(teamId, cycleId, mbiData) {
  try {
    console.log('🔍 Buscando análisis en cache...', { teamId, cycleId });
    
    const { data, error } = await supabase
      .from('ai_analysis_cache')
      .select('*')
      .eq('team_id', teamId)
      .eq('cycle_id', cycleId)
      .gt('expires_at', new Date().toISOString()) // Solo no expirados
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        console.log('📝 No hay cache disponible');
        return null;
      }
      throw error;
    }
    
    // Verificar si los datos cambiaron
    const currentHash = generateDataHash(mbiData);
    if (data.mbi_data_hash !== currentHash) {
      console.log('🔄 Datos MBI cambiaron, invalidando cache');
      // Eliminar cache obsoleto
      await supabase
        .from('ai_analysis_cache')
        .delete()
        .eq('id', data.id);
      return null;
    }
    
    console.log('✅ Cache válido encontrado', { 
      createdAt: data.created_at,
      expiresAt: data.expires_at 
    });
    
    return {
      analysis: data.analysis_data,
      createdAt: data.created_at,
      expiresAt: data.expires_at
    };
    
  } catch (error) {
    console.error('❌ Error accediendo cache:', error);
    return null; // Fallar silenciosamente
  }
}

/**
 * Guarda análisis de IA en cache
 * @param {string} teamId - ID del equipo
 * @param {string} cycleId - ID del ciclo
 * @param {object} analysis - Análisis de IA a guardar
 * @param {object} mbiData - Datos MBI originales
 * @param {number} ttlDays - Días hasta expiración (default: 7)
 */
export async function saveCachedAnalysis(teamId, cycleId, analysis, mbiData, ttlDays = 7) {
  try {
    console.log('💾 Guardando análisis en cache...', { teamId, cycleId, ttlDays });
    
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + ttlDays);
    
    const cacheData = {
      team_id: teamId,
      cycle_id: cycleId,
      analysis_data: analysis,
      mbi_data_hash: generateDataHash(mbiData),
      expires_at: expiresAt.toISOString()
    };
    
    const { error } = await supabase
      .from('ai_analysis_cache')
      .upsert(cacheData, { 
        onConflict: 'team_id,cycle_id' // Actualizar si ya existe
      });
    
    if (error) throw error;
    
    console.log('✅ Análisis guardado en cache hasta:', expiresAt);
    
  } catch (error) {
    console.error('❌ Error guardando cache:', error);
    // No lanzar error, el sistema puede funcionar sin cache
  }
}

/**
 * Invalida cache para un equipo específico
 * @param {string} teamId - ID del equipo
 */
export async function invalidateTeamCache(teamId) {
  try {
    console.log('🗑️ Invalidando cache del equipo:', teamId);
    
    const { error } = await supabase
      .from('ai_analysis_cache')
      .delete()
      .eq('team_id', teamId);
    
    if (error) throw error;
    
    console.log('✅ Cache del equipo invalidado');
    
  } catch (error) {
    console.error('❌ Error invalidando cache:', error);
  }
}

/**
 * Obtiene estadísticas del cache para debugging
 */
export async function getCacheStats() {
  try {
    const { data, error } = await supabase
      .from('ai_analysis_cache')
      .select('team_id, created_at, expires_at')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    const now = new Date();
    const active = data.filter(item => new Date(item.expires_at) > now);
    const expired = data.filter(item => new Date(item.expires_at) <= now);
    
    return {
      total: data.length,
      active: active.length,
      expired: expired.length,
      items: data
    };
    
  } catch (error) {
    console.error('❌ Error obteniendo stats de cache:', error);
    return null;
  }
}
