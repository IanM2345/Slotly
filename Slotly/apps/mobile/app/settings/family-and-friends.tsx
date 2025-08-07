import React, { useState } from 'react';
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
  useTheme
} from 'react-native-paper';
import { useRouter } from 'expo-router';

interface FamilyMember {
  id: string;
  name: string;
  phoneNumber: string;
  relationship?: string;
}

export default function FamilyAndFriendsScreen() {
  const theme = useTheme();
  const router = useRouter();
  
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([
    {
      id: '1',
      name: 'Sarah Doe',
      phoneNumber: '+254712345679',
      relationship: 'Sister'
    },
    {
      id: '2',
      name: 'Michael Doe',
      phoneNumber: '+254712345680',
      relationship: 'Brother'
    }
  ]);
  
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
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const member: FamilyMember = {
        id: Date.now().toString(),
        name: newMember.name.trim(),
        phoneNumber: newMember.phoneNumber.trim(),
        relationship: newMember.relationship.trim() || undefined
      };

      setFamilyMembers(prev => [...prev, member]);
      setNewMember({ name: '', phoneNumber: '', relationship: '' });
      setShowAddModal(false);
    } catch (error) {
      console.error('Error adding family member:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = (id: string) => {
    setFamilyMembers(prev => prev.filter(member => member.id !== id));
  };

  const handleCancel = () => {
    setNewMember({ name: '', phoneNumber: '', relationship: '' });
    setShowAddModal(false);
  };

  return (
    <Surface style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <IconButton
          icon="arrow-left"
          size={24}
          iconColor="#333"
          onPress={handleBack}
        />
        <Text style={styles.headerTitle}>Family and Friends</Text>
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
            
            <Text style={styles.emptyTitle}>Add your Family & Friends</Text>
            <Text style={styles.emptyDescription}>
              link an account to schedule an appointment on behalf of your family or friends.
            </Text>
            
            <Button
              mode="outlined"
              onPress={() => setShowAddModal(true)}
              style={styles.addMemberButton}
              labelStyle={styles.addMemberButtonText}
              contentStyle={styles.addMemberButtonContent}
            >
              Add member
            </Button>
          </View>
        ) : (
          // List of Family Members
          <View style={styles.listContainer}>
            <Text style={styles.listTitle}>Family & Friends</Text>
            
            {familyMembers.map((member) => (
              <Card key={member.id} style={styles.memberCard} mode="outlined">
                <List.Item
                  title={member.name}
                  description={`${member.phoneNumber}${member.relationship ? ` • ${member.relationship}` : ''}`}
                  left={(props) => <List.Icon {...props} icon="account" />}
                  right={(props) => (
                    <IconButton
                      {...props}
                      icon="delete"
                      size={20}
                      iconColor="#ff4444"
                      onPress={() => handleRemoveMember(member.id)}
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
          color="#fff"
        />
      )}

      {/* Add Member Modal */}
      <Portal>
        <Modal
          visible={showAddModal}
          onDismiss={handleCancel}
          contentContainerStyle={styles.modalContainer}
        >
          <Card style={styles.modalCard}>
            <Card.Content>
              <Text style={styles.modalTitle}>Add Family Member</Text>
              
              <View style={styles.modalForm}>
                <TextInput
                  mode="outlined"
                  label="Full Name *"
                  value={newMember.name}
                  onChangeText={(text) => setNewMember(prev => ({ ...prev, name: text }))}
                  style={styles.modalInput}
                  outlineColor="#333"
                  activeOutlineColor="#333"
                  textColor="#333"
                />

                <TextInput
                  mode="outlined"
                  label="Phone Number *"
                  value={newMember.phoneNumber}
                  onChangeText={(text) => setNewMember(prev => ({ ...prev, phoneNumber: text }))}
                  style={styles.modalInput}
                  outlineColor="#333"
                  activeOutlineColor="#333"
                  textColor="#333"
                  keyboardType="phone-pad"
                />

                <TextInput
                  mode="outlined"
                  label="Relationship (Optional)"
                  value={newMember.relationship}
                  onChangeText={(text) => setNewMember(prev => ({ ...prev, relationship: text }))}
                  style={styles.modalInput}
                  outlineColor="#333"
                  activeOutlineColor="#333"
                  textColor="#333"
                  placeholder="e.g., Sister, Friend, etc."
                />
              </View>

              <View style={styles.modalButtons}>
                <Button
                  mode="outlined"
                  onPress={handleCancel}
                  style={styles.cancelButton}
                  labelStyle={styles.cancelButtonText}
                >
                  Cancel
                </Button>
                <Button
                  mode="contained"
                  onPress={handleAddMember}
                  loading={loading}
                  disabled={loading || !newMember.name.trim() || !newMember.phoneNumber.trim()}
                  style={styles.addButton}
                  labelStyle={styles.addButtonText}
                >
                  Add
                </Button>
              </View>
            </Card.Content>
          </Card>
        </Modal>
      </Portal>
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffc0cb', // Light pink background
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
    color: '#333',
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
    color: '#333',
    textAlign: 'center',
    marginBottom: 16,
  },
  emptyDescription: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 40,
    paddingHorizontal: 20,
  },
  addMemberButton: {
    borderColor: '#333',
    borderWidth: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  addMemberButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  addMemberButtonContent: {
    paddingVertical: 8,
    paddingHorizontal: 24,
  },
  listContainer: {
    paddingTop: 16,
  },
  listTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  memberCard: {
    marginBottom: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderColor: '#333',
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  memberDetails: {
    fontSize: 14,
    color: '#666',
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: '#ff69b4',
  },
  modalContainer: {
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#fff',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalForm: {
    gap: 16,
    marginBottom: 24,
  },
  modalInput: {
    backgroundColor: '#f8f8f8',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    borderColor: '#666',
  },
  cancelButtonText: {
    color: '#666',
  },
  addButton: {
    flex: 1,
    backgroundColor: '#ff69b4',
  },
  addButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  bottomSpacing: {
    height: 100,
  },
});