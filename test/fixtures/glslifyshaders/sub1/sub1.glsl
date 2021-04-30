#pragma glslify: sub2 = require(./sub2/sub2.glsl)

float sub1(vec3 normal) {
  return dot(vec3(0, 1, 0), normal) * sub2(normal);
}


#pragma glslify: export(sub1)