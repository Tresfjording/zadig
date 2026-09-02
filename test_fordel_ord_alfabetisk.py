import fordel_ord_alfabetisk as s


def test_skal_tomme_kildekolonne_ignorerer_null_og_nullstilt_telling():
    assert s.skal_tomme_kildekolonne(None) is False
    assert s.skal_tomme_kildekolonne(0) is False
    assert s.skal_tomme_kildekolonne(3) is True
