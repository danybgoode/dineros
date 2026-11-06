"""Inserta data/datos.js en plantilla.html y genera index.html (archivo único publicable)."""
src = open('plantilla.html', encoding='utf-8').read()
data = open('data/datos.js', encoding='utf-8').read().replace('</script', '<\\/script')
open('index.html', 'w', encoding='utf-8').write(src.replace('/*__DATOS__*/', data))
print('index.html', round(len(src) + len(data)) // 1024, 'KB')
