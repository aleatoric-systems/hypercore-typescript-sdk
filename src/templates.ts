export function renderNginxGrpcTemplate(serverName: string, upstream = "127.0.0.1:50051"): string {
  return `# /etc/nginx/conf.d/hypercore-grpc.conf
server {
    listen 443 ssl http2;
    server_name ${serverName};

    ssl_certificate /etc/letsencrypt/live/${serverName}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${serverName}/privkey.pem;

    if ($client_id = "") {
        return 403;
    }

    location / {
        limit_req zone=hft_limit burst=1000 nodelay;
        grpc_pass grpc://${upstream};
        grpc_socket_keepalive on;
        grpc_read_timeout 1h;
        grpc_send_timeout 1h;
    }
}
`;
}
