{pkgs}: {
  deps = [
    pkgs.chromium
    pkgs.nats-server
    pkgs.redis
  ];
}
