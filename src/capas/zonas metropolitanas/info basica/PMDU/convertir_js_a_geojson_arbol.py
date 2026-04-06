# convertir_js_a_geojson_arbol.py

import os
import re
import json


#  */
# /* CONFIGURACIÓN */
# /*  */

# Carpetas que no se recorrerán
CARPETAS_IGNORADAS = {
    "__pycache__",
    ".git",
    "node_modules",
    ".next",
    "dist",
    "build"
}


#  */
# /* FUNCIONES */
# /*  */

def obtener_carpeta_base():
    return os.path.dirname(os.path.abspath(__file__))


def encontrar_archivos_js_recursivo(carpeta_base):
    archivos_js = []

    for raiz, directorios, archivos in os.walk(carpeta_base):
        directorios[:] = [d for d in directorios if d not in CARPETAS_IGNORADAS]

        for archivo in archivos:
            if archivo.lower().endswith(".js"):
                archivos_js.append(os.path.join(raiz, archivo))

    return archivos_js


def extraer_bloque_objeto(texto, inicio_llave):
    nivel = 0
    en_cadena = False
    escape = False
    comilla_actual = None

    for i in range(inicio_llave, len(texto)):
        char = texto[i]

        if en_cadena:
            if escape:
                escape = False
            elif char == "\\":
                escape = True
            elif char == comilla_actual:
                en_cadena = False
                comilla_actual = None
            continue

        if char in ['"', "'"]:
            en_cadena = True
            comilla_actual = char
            continue

        if char == "{":
            nivel += 1
        elif char == "}":
            nivel -= 1
            if nivel == 0:
                return texto[inicio_llave:i + 1]

    raise ValueError("No se pudo cerrar correctamente el objeto del export const.")


def extraer_exports(texto):
    patron = re.compile(r'export\s+const\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*{')
    resultados = []

    for match in patron.finditer(texto):
        nombre_const = match.group(1)
        inicio_objeto = match.end() - 1
        objeto_texto = extraer_bloque_objeto(texto, inicio_objeto)
        resultados.append((nombre_const, objeto_texto))

    return resultados


def obtener_ruta_salida_unica(carpeta, nombre_base):
    ruta = os.path.join(carpeta, f"{nombre_base}.geojson")

    if not os.path.exists(ruta):
        return ruta

    contador = 1
    while True:
        ruta = os.path.join(carpeta, f"{nombre_base}_{contador}.geojson")
        if not os.path.exists(ruta):
            return ruta
        contador += 1


def guardar_geojson(carpeta, nombre, contenido):
    ruta_salida = obtener_ruta_salida_unica(carpeta, nombre)

    try:
        data = json.loads(contenido)
        with open(ruta_salida, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except json.JSONDecodeError:
        with open(ruta_salida, "w", encoding="utf-8") as f:
            f.write(contenido)

    return ruta_salida


#  */
# /* PROGRAMA PRINCIPAL */
# /*  */

def main():
    carpeta_base = obtener_carpeta_base()
    archivos_js = encontrar_archivos_js_recursivo(carpeta_base)

    if not archivos_js:
        print("No se encontraron archivos .js en esta carpeta ni en subcarpetas.")
        return

    print(f"Carpeta base: {carpeta_base}")
    print(f"Archivos .js encontrados: {len(archivos_js)}\n")

    total_js_procesados = 0
    total_geojson_creados = 0

    for ruta_js in archivos_js:
        try:
            with open(ruta_js, "r", encoding="utf-8") as f:
                contenido = f.read()

            exports = extraer_exports(contenido)

            if not exports:
                print(f"[SIN EXPORT CONST] {ruta_js}")
                continue

            total_js_procesados += 1
            carpeta_del_js = os.path.dirname(ruta_js)

            print(f"[PROCESANDO] {ruta_js}")
            print(f"  Export const encontrados: {len(exports)}")

            for nombre_const, objeto in exports:
                ruta_generada = guardar_geojson(carpeta_del_js, nombre_const, objeto)
                print(f"  - Creado: {ruta_generada}")
                total_geojson_creados += 1

            print()

        except Exception as e:
            print(f"[ERROR] {ruta_js}: {e}\n")

    print("Proceso terminado.")
    print(f"Archivos JS procesados: {total_js_procesados}")
    print(f"Archivos GEOJSON creados: {total_geojson_creados}")


if __name__ == "__main__":
    main()