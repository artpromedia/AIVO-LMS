#!/bin/bash
set -e
ssh -o StrictHostKeyChecking=no root@10.0.0.3 'ufw allow 80/tcp comment "HTTP ingress-nginx"; ufw allow 443/tcp comment "HTTPS ingress-nginx"; ufw reload; ufw status numbered | head -20'
