import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, Image } from 'react-native';
import {
  Text,
  Surface,
  IconButton,
  List,
  FAB,
  Portal,
  Modal,
  TextInput,
  Button,
  Card,
  useTheme,
  Snackbar
} from 'react-native-paper';
import { useRouter } from 'expo-router';
import { addFamilyMember, listFamily, removeFamilyMember } from '../../lib/settings/api';
import type { FamilyMember as FamilyMemberType } from '../../lib/settings/types';

export default function FamilyAndFriendsScreen() {
  const theme = useTheme();
  const router = useRouter();
  
  const [familyMembers, setFamilyMembers] = useState<FamilyMemberType[]>([]);
  const [snack, setSnack] = useState<{ visible: boolean; msg: string }>({ visible: false, msg: '' });
  useEffect(() => {
    listFamily().then(setFamilyMembers).catch(() => {});
  }, []);
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [newMember, setNewMember] = useState({
    name: '',
    phoneNumber: '',
    relationship: ''
  });
  const [loading, setLoading] = useState(false);

  const handleBack = () => {
    router.back();
  };

  const handleAddMember = async () => {
    if (!newMember.name.trim() || !newMember.phoneNumber.trim()) {
      return;
    }

    setLoading(true);
    try {
      const member: FamilyMemberType = {
        id: Date.now().toString(),
        name: newMember.name.trim(),
        phone: newMember.phoneNumber.trim(),
        relation: newMember.relationship.trim() || undefined
      };

      await addFamilyMember(member);
      const refreshed = await listFamily();
      setFamilyMembers(refreshed);
      setNewMember({ name: '', phoneNumber: '', relationship: '' });
      setShowAddModal(false);
      setSnack({ visible: true, msg: 'Member added' });
    } catch (error) {
      console.error('Error adding family member:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMemberAction = async (id: string) => {
    await removeFamilyMember(id);
    const refreshed = await listFamily();
    setFamilyMembers(refreshed);
    setSnack({ visible: true, msg: 'Member removed' });
  };

  const handleCancel = () => {
    setNewMember({ name: '', phoneNumber: '', relationship: '' });
    setShowAddModal(false);
  };

  return (
    <Surface style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <IconButton icon="arrow-left" size={24} iconColor={theme.colors.onSurface} onPress={handleBack} />
        <Text style={[styles.headerTitle, { color: theme.colors.onSurface }]}>Family and Friends</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {familyMembers.length === 0 ? (
          // Empty State
          <View style={styles.emptyState}>
            <Image
              source={{ uri: 'https://via.placeholder.com/300x200.png?text=Family+%26+Friends' }}
              style={styles.familyImage}
              resizeMode="contain"
            />
            
            <Text style={[styles.emptyTitle, { color: theme.colors.onSurface }]}>Add your Family & Friends</Text>
            <Text style={[styles.emptyDescription, { color: theme.colors.onSurfaceVariant }]}>
              link an account to schedule an appointment on behalf of your family or friends.
            </Text>
            
            <Button mode="outlined" onPress={() => setShowAddModal(true)} style={{ borderRadius: 24 }}>
              Add member
            </Button>
          </View>
        ) : (
          // List of Family Members
          <View style={styles.listContainer}>
            <Text style={[styles.listTitle, { color: theme.colors.onSurface }]}>Family & Friends</Text>
            
            {familyMembers.map((member) => (
              <Card key={member.id} style={styles.memberCard} mode="outlined">
                <List.Item
                  title={member.name}
                  description={`${member.phone ?? ''}${member.relation ? ` • ${member.relation}` : ''}`}
                  left={(props) => <List.Icon {...props} icon="account" />}
                  right={(props) => (
                    <IconButton
                      {...props}
                      icon="delete"
                      size={20}
                      iconColor={theme.colors.error}
                      onPress={() => handleRemoveMemberAction(member.id)}
                    />
                  )}
                  titleStyle={styles.memberName}
                  descriptionStyle={styles.memberDetails}
                />
              </Card>
            ))}
          </View>
        )}

        {/* Bottom Spacing */}
        <View style={styles.bottomSpacing} />
      </ScrollView>

      {/* Floating Action Button */}
      {familyMembers.length > 0 && (
        <FAB
          icon="plus"
          style={styles.fab}
          onPress={() => setShowAddModal(true)}
        />
      )}

      {/* Add Member Modal */}
      <Portal>
        <Modal
          visible={showAddModal}
          onDismiss={handleCancel}
          contentContainerStyle={styles.modalContainer}
        >
          <Card style={[styles.modalCard, { backgroundColor: theme.colors.surface }]}>
            <Card.Content>
              <Text style={[styles.modalTitle, { color: theme.colors.onSurface }]}>Add Family Member</Text>
              
              <View style={styles.modalForm}>
                <TextInput
                  mode="outlined"
                  label="Full Name *"
                  value={newMember.name}
                  onChangeText={(text) => setNewMember(prev => ({ ...prev, name: text }))}
                  style={styles.modalInput}
                  outlineColor={theme.colors.outline}
                  activeOutlineColor={theme.colors.primary}
                  textColor={theme.colors.onSurface}
                />

                <TextInput
                  mode="outlined"
                  label="Phone Number *"
                  value={newMember.phoneNumber}
                  onChangeText={(text) => setNewMember(prev => ({ ...prev, phoneNumber: text }))}
                  style={styles.modalInput}
                  outlineColor={theme.colors.outline}
                  activeOutlineColor={theme.colors.primary}
                  textColor={theme.colors.onSurface}
                  keyboardType="phone-pad"
                />

                <TextInput
                  mode="outlined"
                  label="Relationship (Optional)"
                  value={newMember.relationship}
                  onChangeText={(text) => setNewMember(prev => ({ ...prev, relationship: text }))}
                  style={styles.modalInput}
                  outlineColor={theme.colors.outline}
                  activeOutlineColor={theme.colors.primary}
                  textColor={theme.colors.onSurface}
                  placeholder="e.g., Sister, Friend, etc."
                />
              </View>

              <View style={styles.modalButtons}>
                <Button mode="outlined" onPress={handleCancel} style={styles.cancelButton}>
                  Cancel
                </Button>
                <Button mode="contained" onPress={handleAddMember} loading={loading} disabled={loading || !newMember.name.trim() || !newMember.phoneNumber.trim()} style={styles.addButton}>
                  Add
                </Button>
              </View>
            </Card.Content>
          </Card>
        </Modal>
      </Portal>
      <Snackbar visible={snack.visible} onDismiss={() => setSnack({ visible: false, msg: '' })} duration={2000}>
        {snack.msg}
      </Snackbar>
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 48,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  familyImage: {
    width: 300,
    height: 200,
    marginBottom: 32,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
  },
  emptyDescription: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 40,
    paddingHorizontal: 20,
  },
  listContainer: {
    paddingTop: 16,
  },
  listTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  memberCard: {
    marginBottom: 12,
    borderColor: 'transparent',
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
  },
  memberDetails: {
    fontSize: 14,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
  },
  modalContainer: {
    padding: 20,
  },
  modalCard: {
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalForm: {
    gap: 16,
    marginBottom: 24,
  },
  modalInput: {
    backgroundColor: 'transparent',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
  },
  addButton: {
    flex: 1,
  },
  bottomSpacing: {
    height: 100,
  },
});