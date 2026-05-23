#!/bin/bash
ssh -o StrictHostKeyChecking=no root@10.0.0.3 'ip -4 addr show eno1 | grep "inet "; df -h /; ss -lntp 2>/dev/null | grep -E ":80 |:443 "'
