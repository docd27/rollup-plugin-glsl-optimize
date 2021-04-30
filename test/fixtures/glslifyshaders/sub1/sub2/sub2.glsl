float sub2(vec3 normal) {
  return dot(vec3(0, 1, 0), normal);
}

#pragma glslify: export(sub2)