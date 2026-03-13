import os

for fil in os.listdir(innboks):
    nytt = fil.replace("–", "-").replace("—", "-")
    if nytt != fil:
        os.rename(os.path.join(innboks, fil),
                  os.path.join(innboks, nytt))