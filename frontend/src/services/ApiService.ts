/**
   * Maps a UUID to a canonical ID, with fallback handling
   */
  public mapUuidToCanonicalId(uuid: string): string | null {
    if (!uuid) {
      console.warn('[API] Tentativa de mapear UUID vazio');
      return null;
    }
    
    // Check if it's a numeric ID already
    if (/^\d+$/.test(uuid)) {
      // It's already a numeric ID, no need to map
      return uuid;
    }
    
    const mapping = this.uuidToIdMap.get(uuid);
    
    if (mapping) {
      console.log(`[API] Mapeando UUID ${uuid} para ID canônico ${mapping}`);
      return mapping;
    } else {
      // Improved error handling for unknown UUIDs
      console.warn(`[API] ⚠️ UUID não reconhecido: ${uuid}, usando fallback`);
      
      // Return a default ID or null
      return null;
    }
  }