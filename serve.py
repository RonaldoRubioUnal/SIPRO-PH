import os
import sys
import time
import socket
import urllib.request
import webbrowser
import subprocess
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PORT = 8085
HOST = "localhost"
URL = f"http://{HOST}:{PORT}/index.html"

def kill_process_on_port(port):
    if sys.platform == "win32":
        try:
            cmd = f'netstat -ano | findstr :{port}'
            out = subprocess.check_output(cmd, shell=True).decode('utf-8', errors='ignore')
            pids = set()
            for line in out.strip().splitlines():
                if "LISTENING" in line:
                    parts = line.split()
                    if parts:
                        pid = parts[-1]
                        if pid.isdigit() and int(pid) != os.getpid():
                            pids.add(pid)
            for pid in pids:
                subprocess.run(f"taskkill /F /PID {pid}", shell=True, capture_output=True)
            if pids:
                time.sleep(0.8)
        except Exception:
            pass

def main():
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    print("=" * 75)
    print("  SIPRO-PH - SISTEMA DE REVISION Y PRIORIZACION TECNICO-DOCUMENTAL")
    print("  GOBERNACION DE ANTIOQUIA - SECRETARIA DE INFRAESTRUCTURA FISICA")
    print("=" * 75)
    print()

    # 1. Liberar procesos previos o zombies en el puerto para garantizar carga limpia
    kill_process_on_port(PORT)

    # 2. Manejador robusto multihilo con desactivación estricta de caché
    class AntiCacheHandler(SimpleHTTPRequestHandler):
        def end_headers(self):
            # Forzar al navegador a solicitar siempre los archivos actualizados
            self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
            self.send_header("Pragma", "no-cache")
            self.send_header("Expires", "0")
            super().end_headers()

        def log_message(self, format, *args):
            try:
                sys.stdout.write("%s - - [%s] %s\n" % (self.address_string(), self.log_date_time_string(), format % args))
                sys.stdout.flush()
            except Exception:
                pass

    server = None
    for attempt in range(3):
        try:
            server = ThreadingHTTPServer(("", PORT), AntiCacheHandler)
            break
        except OSError as e:
            if attempt < 2:
                kill_process_on_port(PORT)
                time.sleep(1)
            else:
                print(f"[!] No fue posible enlazar el puerto {PORT}: {e}")
                sys.exit(1)

    print(f"[+] Servidor multihilo activo en http://{HOST}:{PORT}/")
    print(f"[+] Modo sin cache activado (los cambios en CSS/JS se reflejan inmediatamente)")
    print(f"[+] Abriendo la aplicacion: {URL}")
    print()
    print(">>> Mantenga esta consola abierta mientras usa el sistema <<<")
    print(">>> (Para detener el servidor presione Ctrl + C) <<<")
    print("-" * 75)

    # Abrir navegador
    webbrowser.open(URL)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nCerrando servidor SIPRO-PH...")
        server.server_close()
        print("Servidor detenido correctamente.")

if __name__ == "__main__":
    main()
