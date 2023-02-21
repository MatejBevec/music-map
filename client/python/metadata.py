import sys
import os
import math
import json
import re

import numpy as np
import sklearn
from sklearn.manifold import MDS

def genre_classes(tracks):

    genre_classes = {}

    for track in tracks:
        tags = tracks[track]["artist_genres"]
        genres = genre_class(tags)
        counts = np.array(list(genres.values()))
        pick = np.argmax(counts)
        if np.sum(counts) == 0:
            genre = "other"
        else:
            genre = list(genres.keys())[pick]
        print(tags)
        print(genre, "\n\n")
        genre_classes[track] = genre

    return genre_classes


def genre_class(genre_tags):

    genres = {
        "classical": 0,
        "country": 0,
        "blues": 0,
        "folk": 0,
        "rock": 0,
        "punk": 0,
        "metal": 0,
        "jazz": 0,
        "soul": 0,
        "pop": 0,
        "electronic": 0,
        "hiphop": 0,
        "reggae": 0,
        "latin": 0,
    }

    for tag in genre_tags:

        if re.search(r"classical|violin", tag) is not None:
            genres["classical"] += 1

        if re.search(r"country|hillbilly", tag) is not None:
            genres["country"] += 1

        if re.search(r"blues", tag) is not None:
            genres["blues"] += 1

        if re.search(r"folk|holler", tag) is not None:
            genres["classical"] += 1

        if re.search(r"rock|indie$|alternative$|grunge$|permanent wave", tag) is not None:
            genres["rock"] += 1

        if re.search(r"punk|goth", tag) is not None: # maybe this is just rock?
            genres["punk"] += 1

        if re.search(r"metal|trash|grunge$", tag) is not None:
            genres["metal"] += 1

        if re.search(r"jazz", tag) is not None:
            genres["jazz"] += 1

        if re.search(r"soul|r&b|funk|disco", tag) is not None:
            genres["soul"] += 1

        if re.search(r"pop", tag) is not None:
            genres["pop"] += 1

        if re.search(r"electronic|electro|synthpop|wave", tag) is not None or \
        re.search(r"house|techno|beat|downtempo|trance|hardcore|edm|dnb|ebm|idm|dance|glitch|hyperpop", tag) is not None:
            genres["electronic"] += 1

        if re.search(r"hip hop|rap|trap", tag) is not None:
            genres["hiphop"] += 1

        if re.search(r"latin|reggaeton|salsa|tropical|bossa|musica|mpb|spanish|espanol|mariachi|ranchera|mexican|forro|tango", tag) is not None:
            genres["latin"] += 1

        if re.search(r"reggae|dub", tag) is not None:
            genres["reggae"] += 1

    return genres


if __name__ == "__main__":
    

    if sys.argv[1] == "genres":
        pth = sys.argv[2] + "/tracks.json"
        with open(pth, "r", encoding="utf-8") as f:
            tracks = json.load(f)
        classes = genre_classes(tracks)
        for track in tracks:
            tracks[track]["genre_class"] = classes[track]
        with open(pth, "w", encoding="utf-8") as f:
            json.dump(tracks, f, indent=2)
