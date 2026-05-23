#!/bin/bash
ssh -o StrictHostKeyChecking=no root@10.0.0.3 'ip -4 addr show | grep "inet " | grep -v "10.0.0\|127.0.0\|172.17\|10.42"; curl -s --max-time 5 https://api.ipify.org; echo'
