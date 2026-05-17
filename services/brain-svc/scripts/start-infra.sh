#!/bin/bash
echo "Installing brain-svc Python dependencies..."
pip install -q -r /home/runner/workspace/services/brain-svc/requirements.txt 2>/dev/null
echo "Brain service dependencies ready."
