#version 300 es
precision highp float;
precision highp int;
precision lowp sampler2D;

#include "include.frag"

in highp vec2 v_texcoord_a;
in highp vec2 v_texcoord_b;
flat in highp ivec2 v_texlayer_a;
flat in highp ivec2 v_texlayer_b;
flat in highp float f_tex_interp;

uniform lowp sampler2DArray u_atlas0;

#pragma glslify: topDot = require(./sub1/sub1.glsl)

void main() {
  float something = topDot(vec3(0, 1, 0));

  vec4 texel;
  vec4 texelA = texture(u_atlas0, vec3(v_texcoord_a, v_texlayer_a.x));

  if (f_tex_interp <= 0.0) {
    texel = texelA;
  } else {
    vec4 texelB = texture(u_atlas0, vec3(v_texcoord_b, v_texlayer_b.x));
    texel = mix(texelA, texelB, f_tex_interp);
  }
  if(texel.a < 0.5) {
    discard;
  }
  texel += something;
}