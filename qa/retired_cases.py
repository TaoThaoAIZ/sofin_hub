# -*- coding: utf-8 -*-
"""Testcase đã LOẠI BỎ vì lỗi thời / trùng / không còn đúng với hệ thống.
Khóa = mã TC (vd "TC-COMMS-012"), giá trị = lý do. Case bị loại vẫn chiếm số thứ tự của nó (mã các case khác không đổi) và được lưu
vào qa/archive/retired_cases.csv mỗi lần sinh xlsx. KHÔNG xóa case khỏi cases_*.py; chỉ thêm mã vào đây (hoặc vào retired_part_*.py,
tự được gộp ở dưới — dùng khi nhiều người rà soát song song)."""
import glob
import importlib.util
import os

RETIRED = {}

for _p in sorted(glob.glob(os.path.join(os.path.dirname(os.path.abspath(__file__)), "retired_part_*.py"))):
    _spec = importlib.util.spec_from_file_location(os.path.basename(_p)[:-3], _p)
    _m = importlib.util.module_from_spec(_spec)
    _spec.loader.exec_module(_m)
    _dup = set(RETIRED) & set(_m.RETIRED)
    if _dup:
        raise SystemExit(f"{_p}: mã trùng giữa các phần: {sorted(_dup)[:5]}")
    RETIRED.update(_m.RETIRED)
