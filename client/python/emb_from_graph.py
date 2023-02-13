import sys
import os
import math
import json

import numpy as np
import sklearn
from sklearn.manifold import MDS


def jaccard_index(g):

    print(type(g))

    tracks = g["tracks"]
    edges = g["edges"]
    n = len(tracks)

    nbh_sets = []
    for i,t in enumerate(tracks):
        if i%100 == 0: print(i)
        inbh = set([edge["to"] for edge in edges if edge["from"] == t])
        nbh_sets.append(inbh)

    sims = np.zeros((n, n))
    for i in range(n):
        if i%100 == 0: print(i)
        iid = tracks[i]
        for j in range(n):
            jid = tracks[j]

            intersect = nbh_sets[i] & nbh_sets[j]
            union = nbh_sets[i] | nbh_sets[j]

            sims[i, j] = len(intersect) / len(union)

    return sims


def emb_from_sims(sims):

    print("embedding")

    mds = MDS(n_components=64, metric=True, dissimilarity="precomputed")

    emb = mds.fit_transform(sims)

    return emb

if __name__ == "__main__":

    gpth = sys.argv[1]
    savepth = gpth.rsplit(".")[-2] + "_emb.json"

    with open(gpth, "r") as f:
        g = json.load(f)

    sims = jaccard_index(g)
    emb = emb_from_sims(sims)

    print(savepth)

    with open(savepth, "w") as f:
        json.dump(emb.tolist(), f, separators=(',', ':'))
