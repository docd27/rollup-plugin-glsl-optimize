export default {
  targets: ['win64', 'ubuntu64', 'macos64'],
  sources: [
    {
      name: 'glslangValidator',
      type: 'githubrelease',
      verargs: ['--version'],
      vermatch: /Glslang Version:\s*10:([^$\r\n]+)/i,
      repo: 'KhronosGroup/glslang',
      matchers: {
        win64: /glslang.*windows.*x64.*release/i,
        ubuntu64: /glslang.*linux.*release/i,
        macos64: /glslang.*osx.*release/i,
      },
      filelist: {
        win64: ['bin/glslangValidator.exe'],
        ubuntu64: ['bin/glslangValidator'],
        macos64: ['bin/glslangValidator'],
      }
    },
    {
      name: 'spirv-opt',
      type: 'spirvtoolsci',
      verargs: ['--version'],
      vermatch: /SPIRV-Tools\s*([^$\r\n]+)/i,
      urls: {
        win64: 'https://storage.googleapis.com/spirv-tools/badges/build_link_windows_vs2017_release.html',
        ubuntu64: 'https://storage.googleapis.com/spirv-tools/badges/build_link_linux_clang_release.html',
        macos64: 'https://storage.googleapis.com/spirv-tools/badges/build_link_macos_clang_release.html',
      },
      matchers: {
        win64: /windows.*\/([^-\/]+)-[^\/]+\/([^\/]+)$/i,
        ubuntu64: /linux.*\/([^-\/]+)-[^\/]+\/([^\/]+)$/i,
        macos64: /macos.*\/([^-\/]+)-[^\/]+\/([^\/]+)$/i,
      },
      filelist: {
        win64: ['install/bin/spirv-opt.exe'],
        ubuntu64: ['install/bin/spirv-opt'],
        macos64: ['install/bin/spirv-opt'],
      }
    },
    {
      name: 'spirv-cross',
      type: 'githubrelease',
      verargs: ['--revision'],
      vermatch: /Timestamp:\s*([^T$\r\n]+)T/i,
      repo: 'KhronosGroup/SPIRV-Cross',
      matchers: {
        win64: /spirv-cross.*vs20.*64bit/i,
        ubuntu64: /spirv-cross.*clang.*trusty.*64bit/i,
        macos64: /spirv-cross.*clang.*macos.*64bit/i,
      },
      filelist: {
        win64: ['bin/spirv-cross.exe'],
        ubuntu64: ['bin/spirv-cross'],
        macos64: ['bin/spirv-cross'],
      },
    },
  ],
  include: [
    {
      name: 'glslangValidator LICENSE',
      url: 'https://raw.githubusercontent.com/KhronosGroup/glslang/master/LICENSE.txt',
      fileList: [
        'glslangValidator-LICENSE'
      ]
    },
    {
      name: 'spirv-opt LICENSE',
      url: 'https://raw.githubusercontent.com/KhronosGroup/SPIRV-Tools/master/LICENSE',
      fileList: [
        'spirv-opt-LICENSE'
      ]
    },
    {
      name: 'spirv-cross LICENSE',
      url: 'https://raw.githubusercontent.com/KhronosGroup/SPIRV-Cross/master/LICENSE',
      fileList: [
        'spirv-cross-LICENSE'
      ]
    }
  ],
};
