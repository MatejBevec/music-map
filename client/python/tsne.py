import sys
import os
import math
import json

import numpy as np
import sklearn
from sklearn.manifold import TSNE




def compute_tsne(emb):

    emb = np.array(emb)

    tsne = TSNE(n_components=2,
                perplexity=30.0,
                early_exaggeration=12.0,
                learning_rate="auto",
                n_iter=1000,
            )

    proj = tsne.fit_transform(emb)
    proj -= np.min(proj, axis=0)
    proj /= np.max(proj, axis=0)

    return proj



if __name__ == "__main__":

    embpth = sys.argv[1]
    savepth = embpth.rsplit(".")[-2] + "_proj.json"

    with open(embpth, "r") as f:
        emb = json.load(f)

    proj = compute_tsne(emb)

    print(savepth)

    with open(savepth, "w") as f:
        json.dump(proj.tolist(), f, separators=(',', ':'))
