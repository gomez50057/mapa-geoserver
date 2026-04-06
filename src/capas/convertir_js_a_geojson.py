# convertir_todos_js_a_geojson.py

import os
import re
import json


def encontrar_archivos_js(carpeta):
    archivos_js = [
        os.path.join(carpeta, f)
        for f in os.listdir(carpeta)
        if f.lower().endswith(".js")
    ]

    if not archivos_js:
        raise FileNotFoundError("No se encontró ningún archivo .js en esta carpeta.")

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


def guardar_geojson(carpeta, nombre, contenido):
    ruta_salida = os.path.join(carpeta, f"{nombre}.geojson")

    try:
        data = json.loads(contenido)
        with open(ruta_salida, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except json.JSONDecodeError:
        with open(ruta_salida, "w", encoding="utf-8") as f:
            f.write(contenido)

    return ruta_salida




def main():
    carpeta_actual = os.path.dirname(os.path.abspath(__file__))
    archivos_js = encontrar_archivos_js(carpeta_actual)

    print(f"Carpeta analizada: {carpeta_actual}")
    print(f"Archivos JS encontrados: {len(archivos_js)}\n")

    total_geojson = 0

    for ruta_js in archivos_js:
        nombre_archivo = os.path.basename(ruta_js)

        try:
            with open(ruta_js, "r", encoding="utf-8") as f:
                contenido = f.read()

            exports = extraer_exports(contenido)

            if not exports:
                print(f"[SIN EXPORT CONST] {nombre_archivo}")
                continue

            print(f"[PROCESANDO] {nombre_archivo} -> {len(exports)} export const encontrados")

            for nombre_const, objeto in exports:
                ruta_generada = guardar_geojson(carpeta_actual, nombre_const, objeto)
                print(f"  - Creado: {os.path.basename(ruta_generada)}")
                total_geojson += 1

        except Exception as e:
            print(f"[ERROR] {nombre_archivo}: {e}")

    print(f"\nProceso terminado. Total de archivos .geojson creados: {total_geojson}")


if __name__ == "__main__":
    main()