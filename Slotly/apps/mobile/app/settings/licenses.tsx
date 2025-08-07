import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import {
  Text,
  Surface,
  IconButton,
  useTheme
} from 'react-native-paper';
import { useRouter } from 'expo-router';

export default function LicensesScreen() {
  const theme = useTheme();
  const router = useRouter();

  const handleBack = () => {
    router.back();
  };

  const licensesText = `
THIRD-PARTY LICENSES AND ACKNOWLEDGMENTS

Slotly uses various open-source libraries and third-party services. We acknowledge and thank the developers and contributors of these projects.

REACT NATIVE
Copyright (c) Meta Platforms, Inc. and affiliates.
Licensed under the MIT License.

REACT NATIVE PAPER
Copyright (c) 2017-present, Callstack.
Licensed under the MIT License.

EXPO
Copyright (c) 2015-present, 650 Industries, Inc.
Licensed under the MIT License.

REACT NAVIGATION
Copyright (c) 2017 React Navigation Contributors
Licensed under the MIT License.

ASYNC STORAGE
Copyright (c) 2015-present, Facebook, Inc.
Licensed under the MIT License.

VECTOR ICONS
Copyright (c) 2015 Joel Arvidsson
Licensed under the MIT License.

DATE-FNS
Copyright (c) 2021 Sasha Koss and Lesha Koss
Licensed under the MIT License.

LODASH
Copyright JS Foundation and other contributors
Licensed under the MIT License.

AXIOS
Copyright (c) 2014-present Matt Zabriskie
Licensed under the MIT License.

REACT HOOK FORM
Copyright (c) 2019-present Beier(Bill) Luo
Licensed under the MIT License.

YUP
Copyright (c) 2014 Jason Quense
Licensed under the MIT License.

MOMENT.JS
Copyright (c) JS Foundation and other contributors
Licensed under the MIT License.

MIT LICENSE

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

ADDITIONAL ACKNOWLEDGMENTS

We also acknowledge the use of various design resources, icons, and fonts that contribute to the user experience of our application. All trademarks and registered trademarks are the property of their respective owners.

For questions regarding licenses or to report any license-related issues, please contact us at legal@slotly.com.

Last updated: January 2024
  `;

  return (
    <Surface style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <IconButton
          icon="arrow-left"
          size={24}
          iconColor="#333"
          onPress={handleBack}
          style={styles.backButton}
        />
        <Text style={styles.headerTitle}>Licences</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.contentContainer}>
          <Text style={styles.contentText}>{licensesText}</Text>
        </View>

        {/* Bottom Spacing */}
        <View style={styles.bottomSpacing} />
      </ScrollView>
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffc0cb', // Slotly pink background
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingTop: 16,
    paddingBottom: 16,
  },
  backButton: {
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    textAlign: 'center',
    marginRight: 48, // Compensate for back button width
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },
  contentContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    padding: 20,
    marginTop: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  contentText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#333',
    textAlign: 'justify',
  },
  bottomSpacing: {
    height: 40,
  },
});
