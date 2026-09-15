import pytest

from openlabeller.image.shapes import Shape


def test_rectangle_to_dict_and_back():
    shape = Shape("rectangle", "cat", points=[(1.0, 2.0), (3.0, 4.0)])

    data = shape.to_dict()
    assert data == {
        "label": "cat",
        "points": [[1.0, 2.0], [3.0, 4.0]],
        "group_id": None,
        "shape_type": "rectangle",
        "flags": {},
    }

    restored = Shape.from_dict(data)
    assert restored.shape_type == "rectangle"
    assert restored.label == "cat"
    assert restored.points == [(1.0, 2.0), (3.0, 4.0)]


def test_polygon_roundtrip_preserves_all_points():
    points = [(0.0, 0.0), (10.0, 0.0), (10.0, 10.0), (0.0, 10.0)]
    shape = Shape("polygon", "blob", points=points)

    restored = Shape.from_dict(shape.to_dict())

    assert restored.points == points


def test_unknown_shape_type_rejected():
    with pytest.raises(ValueError):
        Shape("triangle", "x", points=[(0.0, 0.0)])


def test_group_id_and_flags_roundtrip():
    shape = Shape("point", "marker", points=[(5.0, 5.0)], group_id=3, flags={"difficult": True})

    restored = Shape.from_dict(shape.to_dict())

    assert restored.group_id == 3
    assert restored.flags == {"difficult": True}
