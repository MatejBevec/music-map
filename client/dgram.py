import sys
import os
import math
import json

import numpy as np
import sklearn
from scipy.cluster import hierarchy


def compute_dgram(pts):

    pts = np.array(pts)

    linkage = hierarchy.linkage(list(zip(pts[:,0], pts[:,1])), method='ward', metric='euclidean')

    #dgram = np.zeros((pts.shape[0] + linkage.shape[0], 3))

    dgram = linkage[:, :4]

    return dgram



if __name__ == "__main__":

    srcpth = sys.argv[1]
    savepth = srcpth.rsplit(".")[-2] + "_dgram.json"

    with open(srcpth, "r") as f:
        pts = json.load(f)

    dgram = compute_dgram(pts)

    print(savepth)

    with open(savepth, "w") as f:
        json.dump(dgram.tolist(), f, separators=(',', ':'))
