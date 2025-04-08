#!/bin/bash

# Atualiza os caminhos de importação para usar @/lib/utils
find . -type f -name "*.tsx" -exec sed -i 's/from "..\/..\/lib\/utils"/from "@\/lib\/utils"/g' {} +
find . -type f -name "*.tsx" -exec sed -i 's/from "..\/lib\/utils"/from "@\/lib\/utils"/g' {} +
find . -type f -name "*.tsx" -exec sed -i 's/from "lib\/utils"/from "@\/lib\/utils"/g' {} + 