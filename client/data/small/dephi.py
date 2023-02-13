import os 
import sys
import json

import pandas as pd


def edge_csv(pth, save_pth):
    with open(pth, "r") as f:
        edges = json.load(f)["edges"]
    with open(save_pth, "w") as f:
        for e in edges:
            f.write(f"{e['from']};{e['to']}\n")

def node_csv(pth, trpth, colpth, save_pth):
    with open(pth, "r", encoding="utf-8") as f:
        g = json.load(f)
        nodes = g["tracks"] + g["collections"]
    with open(trpth, "r", encoding="utf-8") as f:
        tr = json.load(f)
    with open(colpth, "r", encoding="utf-8") as f:
        col = json.load(f)

    rows = []
    for nd in nodes:
        label = col[nd]["name"] if nd in col else tr[nd]["name"]
        image = None if nd in col else f"{nd}.jpg"
        row = {"id": nd, "image": image, "label": label}
        rows.append(row)

    pd.DataFrame(rows).to_csv(save_pth, index=False)



if __name__ == "__main__":
    #edge_csv("graph.json", "edges.csv")
    node_csv("graph.json", "tracks.json", "collections.json", "nodes.csv")


