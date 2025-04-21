#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import re
import sys
from collections import defaultdict
import ast
from typing import Dict, List, Set, Tuple

# Cores para saída no terminal
class Colors:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'

def print_color(text, color):
    """Imprime texto colorido no terminal"""
    print(f"{color}{text}{Colors.ENDC}")

def find_all_python_files(directory: str) -> List[str]:
    """Encontra todos os arquivos Python em um diretório"""
    python_files = []
    for root, _, files in os.walk(directory):
        for file in files:
            if file.endswith('.py'):
                python_files.append(os.path.join(root, file))
    return python_files

def extract_imports_ast(file_path: str) -> Tuple[List[str], List[str]]:
    """Extrai imports usando AST (mais preciso)"""
    try:
        with open(file_path, 'r', encoding='utf-8') as file:
            content = file.read()
        
        tree = ast.parse(content)
        
        imports = []
        from_imports = []
        
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for name in node.names:
                    imports.append(name.name)
            elif isinstance(node, ast.ImportFrom):
                if node.module is not None:  # Ignora 'from . import x'
                    for name in node.names:
                        from_imports.append(f"{node.module}.{name.name}")
        
        return imports, from_imports
    except Exception as e:
        print(f"Erro ao analisar {file_path}: {e}")
        return [], []

def extract_imports_regex(file_path: str) -> List[str]:
    """Extrai imports usando regex como fallback"""
    imports = []
    try:
        with open(file_path, 'r', encoding='utf-8') as file:
            content = file.read()
        
        # Padrão para import direto
        import_pattern = r'import\s+([\w\.]+)'
        # Padrão para from ... import
        from_pattern = r'from\s+([\w\.]+)\s+import'
        
        for match in re.finditer(import_pattern, content):
            imports.append(match.group(1))
        
        for match in re.finditer(from_pattern, content):
            imports.append(match.group(1))
            
        return imports
    except Exception as e:
        print(f"Erro ao ler {file_path}: {e}")
        return []

def get_module_name(file_path: str, base_dir: str) -> str:
    """Converte um caminho de arquivo para um nome de módulo importável"""
    rel_path = os.path.relpath(file_path, base_dir)
    module_path = os.path.splitext(rel_path)[0]  # Remove a extensão .py
    return module_path.replace(os.path.sep, '.')

def get_root_modules(module_name: str) -> List[str]:
    """Obtém o módulo raiz de um nome de módulo"""
    parts = module_name.split('.')
    result = [parts[0]]
    for i in range(1, len(parts)):
        result.append(f"{result[i-1]}.{parts[i]}")
    return result

def analyze_imports(directory: str) -> Tuple[Dict[str, Set[str]], Dict[str, Set[str]], List[str]]:
    """Analisa todos os imports nos arquivos Python do diretório"""
    python_files = find_all_python_files(directory)
    print(f"Encontrados {len(python_files)} arquivos Python para análise.")
    
    # Mapeia arquivo -> seus imports
    file_imports = {}
    # Mapeia módulo -> arquivos que o importam
    imported_by = defaultdict(set)
    # Lista todos os módulos
    all_modules = []
    
    for file_path in python_files:
        module_name = get_module_name(file_path, os.path.dirname(directory))
        all_modules.append((module_name, file_path))
        
        imports_ast, from_imports_ast = extract_imports_ast(file_path)
        imports_regex = extract_imports_regex(file_path)
        
        # Usa AST se disponível, senão usa regex
        if imports_ast or from_imports_ast:
            imports = imports_ast + [f.split('.')[0] for f in from_imports_ast]
        else:
            imports = imports_regex
            
        file_imports[file_path] = set(imports)
        
        # Adiciona imports raiz (por exemplo: para 'os.path', adiciona 'os')
        root_imports = set()
        for imp in imports:
            root_modules = get_root_modules(imp)
            root_imports.update(root_modules)
            
        file_imports[file_path].update(root_imports)
    
    # Constrói o mapa reverso de quem importa quem
    for file_path, imports in file_imports.items():
        for imp in imports:
            imported_by[imp].add(file_path)
    
    # Identifica os arquivos não utilizados (não importados por ninguém)
    unused_files = []
    core_modules = {'__main__', 'scraper_core', 'server', 'run_real_scraper', 
                    'config', 'run_scraper_with_analytics', 'analytics', 
                    'data_source_mongo', 'scraper_mongodb'}
    
    for module_name, file_path in all_modules:
        # Verificamos se o módulo aparece como uma importação em qualquer arquivo
        is_imported = False
        
        # Nome do módulo sem o caminho
        module_basename = module_name.split('.')[-1]
        
        # Verifica se o módulo é importado por algum arquivo
        for imp, files in imported_by.items():
            if module_basename == imp or module_name == imp:
                is_imported = True
                break
        
        # Se for um módulo principal (executável) ou um script de teste, não é considerado não utilizado
        if (module_basename in core_modules or 
            module_basename.startswith('test_') or 
            module_basename.startswith('debug_') or 
            module_basename.startswith('fix_') or 
            module_basename.startswith('run_') or 
            module_basename.startswith('check_') or 
            'test' in module_basename or 
            'main' in module_basename):
            continue
        
        # Se não for importado, adiciona à lista de não utilizados
        if not is_imported:
            unused_files.append((module_name, file_path))
    
    return file_imports, imported_by, unused_files

def analyze_file_usage(directory: str = './backend/scraper'):
    """Analisa a utilização de arquivos em um diretório"""
    print_color(f"Analisando importações na pasta {directory}...", Colors.HEADER)
    
    # Obtém o caminho absoluto se for passado um caminho relativo
    if not os.path.isabs(directory):
        directory = os.path.abspath(directory)
    
    file_imports, imported_by, unused_files = analyze_imports(directory)
    
    # Imprime os resultados
    print_color("\nArquivos que não são importados por nenhum outro arquivo:", Colors.BOLD)
    
    for module_name, file_path in unused_files:
        # Obtém o tamanho do arquivo
        try:
            size = os.path.getsize(file_path)
            size_str = f"{size/1024:.1f}KB"
        except:
            size_str = "Tamanho desconhecido"
            
        # Conta linhas do arquivo
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                line_count = sum(1 for _ in f)
        except:
            line_count = "?"
            
        relative_path = os.path.relpath(file_path, directory)
        print_color(f"  {relative_path} ({size_str}, {line_count} linhas)", Colors.YELLOW)
    
    # Mostra os arquivos mais importados (possivelmente utilidades/bibliotecas)
    print_color("\nArquivos mais importados (podem ser bibliotecas/utilidades):", Colors.BOLD)
    
    most_imported = sorted(
        [(module, len(files)) for module, files in imported_by.items() if '.' not in module and not module.startswith('_')],
        key=lambda x: x[1],
        reverse=True
    )
    
    for module, count in most_imported[:10]:
        if count > 1:  # Só mostra se for importado por mais de um arquivo
            print_color(f"  {module}: importado por {count} arquivos", Colors.GREEN)
    
    # Analisa possíveis scripts de utilização única
    print_color("\nPossíveis scripts de utilização única:", Colors.BOLD)
    
    for module_name, file_path in unused_files:
        # Verificamos se o arquivo começa com prefixos típicos de scripts
        basename = os.path.basename(file_path)
        if basename.startswith(('fix_', 'force_', 'insert_', 'modify_', 'reset_')):
            relative_path = os.path.relpath(file_path, directory)
            print_color(f"  {relative_path}", Colors.CYAN)
    
    print_color("\nResumo da análise:", Colors.BOLD)
    print(f"- Total de arquivos Python: {len(file_imports)}")
    print(f"- Arquivos não importados por outros: {len(unused_files)}")
    
    # Categorias de scripts
    test_scripts = [f for f in file_imports.keys() if os.path.basename(f).startswith(('test_', 'debug_'))]
    maintenance_scripts = [f for f in file_imports.keys() if os.path.basename(f).startswith(('fix_', 'force_', 'insert_', 'modify_', 'reset_'))]
    check_scripts = [f for f in file_imports.keys() if os.path.basename(f).startswith('check_')]
    
    print(f"- Scripts de teste/debug: {len(test_scripts)}")
    print(f"- Scripts de manutenção: {len(maintenance_scripts)}")
    print(f"- Scripts de verificação: {len(check_scripts)}")

if __name__ == "__main__":
    # Usa o diretório passado como argumento ou o padrão
    directory = sys.argv[1] if len(sys.argv) > 1 else './backend/scraper'
    analyze_file_usage(directory) 