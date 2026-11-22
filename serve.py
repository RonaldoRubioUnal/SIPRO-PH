import os
import sys
import time
import socket
import urllib.request
import webbrowser
import subprocess
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer, _get_best_family

PORT = 8085                         
HOST = "localhost"
URL = f"http://{HOST}:{PORT}/index.html"
FALLBACK_URL = f"http://127.0.0.1:{PORT}/index.html"

def is_server_healthy(port):
    """Verifica si ya existe un servidor web activo y respondiendo en el puerto."""
    for test_url in [f"http://127.0.0.1:{port}/index.html", f"http://localhost:{port}/index.html"]:
        try:
            req = urllib.request.Request(test_url, method="HEAD")
            with urllib.request.urlopen(req, timeout=0.35) as r:
                if r.status in (200, 304):
                    return True
        except Exception:
            pass
    return False

def kill_process_on_port(port):
    """Libera procesos huérfanos o colgados en el puerto especificado."""
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

class RobustDualStackServer(ThreadingHTTPServer):
    """Servidor multihilo con soporte Dual-Stack (IPv4 127.0.0.1 e IPv6 ::1)."""
    daemon_threads = True
    allow_reuse_address = True

    def server_bind(self):
        try:
            # Habilitar dual stack IPv4/IPv6 simultáneo en el socket
            self.socket.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)
        except (AttributeError, OSError):
            pass
        super().server_bind()

    def handle_error(self, request, client_address):
        # Ignorar desconexiones habituales del cliente al refrescar la página (F5)
        exc_type = sys.exc_info()[0]
        if exc_type in (ConnectionResetError, BrokenPipeError, ConnectionAbortedError, OSError):
            return
        super().handle_error(request, client_address)

class AntiCacheHandler(SimpleHTTPRequestHandler):
    """Manejador HTTP con desactivación estricta de caché y manejo limpio de sockets."""
    protocol_version = "HTTP/1.1"

    def end_headers(self):
        # Forzar al navegador a solicitar siempre los archivos actualizados
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        self.send_header("Access-Control-Allow-Origin", "*")
        super().end_headers()

    def copyfile(self, source, outputfile):
        # Manejo limpio y silencioso de desconexiones abruptas del cliente
        try:
            super().copyfile(source, outputfile)
        except (ConnectionResetError, BrokenPipeError, ConnectionAbortedError, OSError):
            pass

    def log_message(self, format, *args):
        try:
            sys.stdout.write("%s - - [%s] %s\n" % (self.address_string(), self.log_date_time_string(), format % args))
            sys.stdout.flush()
        except Exception:
            pass

def main():
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    args = sys.argv[1:]
    no_browser = "--no-browser" in args or "--daemon" in args
    force_restart = "--restart" in args or "--force" in args

    print("=" * 75)
    print("  SIPRO-PH - SISTEMA DE REVISION Y PRIORIZACION TECNICO-DOCUMENTAL")
    print("  GOBERNACION DE ANTIOQUIA - SECRETARIA DE INFRAESTRUCTURA FISICA")
    print("=" * 75)
    print()

    # Si ya hay un servidor activo y saludable, abrir navegador si corresponde
    if is_server_healthy(PORT) and not force_restart:
        print(f"[✓] El servidor ya se encuentra activo y respondiendo en el puerto {PORT}.")
        print(f"[✓] URL disponible: {URL}")
        if not no_browser:
            print("[+] Abriendo aplicacion en el navegador...")
            webbrowser.open(URL)
        return

    # 1. Liberar procesos previos o zombies en el puerto
    kill_process_on_port(PORT)

    # 2. Configurar enlace Dual-Stack (IPv6 [::1] + IPv4 127.0.0.1)
    server = None
    for attempt in range(3):
        try:
            try:
                family, addr = _get_best_family(None, PORT)
                RobustDualStackServer.address_family = family
                server = RobustDualStackServer(addr, AntiCacheHandler)
            except Exception:
                RobustDualStackServer.address_family = socket.AF_INET
                server = RobustDualStackServer(("0.0.0.0", PORT), AntiCacheHandler)
            break
        except OSError as e:
            if attempt < 2:
                kill_process_on_port(PORT)
                time.sleep(1)
            else:
                print(f"[!] No fue posible enlazar el puerto {PORT}: {e}")
                sys.exit(1)

    print(f"[+] Servidor multihilo activo en http://{HOST}:{PORT}/ (Dual-Stack IPv4/IPv6)")
    print(f"[+] Modo sin cache activado (los cambios en CSS/JS se reflejan inmediatamente)")
    print(f"[+] Direccion alternativa directa: {FALLBACK_URL}")
    print()

    # 3. Abrir navegador si no se especifico lo contrario
    if not no_browser:
        print(f"[+] Abriendo la aplicacion: {URL}")
        webbrowser.open(URL)

    print(">>> Servidor ejecutandose continuamente. Puede recargar libremente con F5 <<<")
    print(">>> (Para detener el servidor presione Ctrl + C) <<<")
    print("-" * 75)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nCerrando servidor SIPRO-PH...")
        server.server_close()
        print("Servidor detenido correctamente.")

if __name__ == "__main__":
    main()
