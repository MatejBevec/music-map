#!/bin/bash

python emb_from_graph.py $1
python proj.py $1
python dgram.py $1
