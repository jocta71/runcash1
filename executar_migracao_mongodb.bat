@echo off
echo Iniciando Migração do MongoDB para coleções separadas...
call .\mongo_migration_env\Scripts\activate.bat
python mongo_migration_roletas.py %*
pause
