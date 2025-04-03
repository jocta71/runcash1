@app.route('/api/allowed-roulettes', methods=['GET'])
@log_request_info
def get_allowed_roulettes():
    """Retorna a lista de IDs de roletas permitidas"""
    try:
        # Importar diretamente da config/ambiente
        try:
            from config import roleta_permitida_por_id
            
            # Verificar se há uma lista definida no arquivo config
            if hasattr(config, "ROLETAS_PERMITIDAS"):
                allowed_ids = config.ROLETAS_PERMITIDAS
            else:
                # Caso não tenha, usar a variável de ambiente
                import os
                allowed_ids = os.environ.get('ALLOWED_ROULETTES', '').split(',')
                allowed_ids = [r.strip() for r in allowed_ids if r.strip()]
                
                # Se não houver nada configurado, usar valores padrão
                if not allowed_ids:
                    allowed_ids = [
                        "2010016",  # Immersive Roulette
                        "2380335",  # Brazilian Mega Roulette
                        "2010065",  # Bucharest Auto-Roulette
                        "2010096",  # Speed Auto Roulette
                        "2010017",  # Auto-Roulette
                        "2010098"   # Auto-Roulette VIP
                    ]
        except ImportError:
            # Caso não consiga importar, usar variável de ambiente
            import os
            allowed_ids = os.environ.get('ALLOWED_ROULETTES', '').split(',')
            allowed_ids = [r.strip() for r in allowed_ids if r.strip()]
            
            # Se não houver nada configurado, usar valores padrão
            if not allowed_ids:
                allowed_ids = [
                    "2010016",  # Immersive Roulette
                    "2380335",  # Brazilian Mega Roulette
                    "2010065",  # Bucharest Auto-Roulette
                    "2010096",  # Speed Auto Roulette
                    "2010017",  # Auto-Roulette
                    "2010098"   # Auto-Roulette VIP
                ]
        
        # Adicionar informações de nome, se disponíveis
        roulette_names = {
            "2010016": "Immersive Roulette",
            "2380335": "Brazilian Mega Roulette",
            "2010065": "Bucharest Auto-Roulette",
            "2010096": "Speed Auto Roulette",
            "2010017": "Auto-Roulette",
            "2010098": "Auto-Roulette VIP"
        }
        
        # Criar lista de objetos com id e nome
        roulettes = []
        for id in allowed_ids:
            name = roulette_names.get(id, f"Roleta {id}")
            roulettes.append({"id": id, "name": name})
            
        return jsonify({
            "success": True,
            "allowed_ids": allowed_ids,
            "roulettes": roulettes
        })
    except Exception as e:
        app.logger.error(f"Erro ao obter roletas permitidas: {e}")
        return jsonify({
            "success": False,
            "error": str(e),
            "allowed_ids": []
        }), 500 