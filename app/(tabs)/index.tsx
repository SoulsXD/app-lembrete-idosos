import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert, Modal, Vibration, Platform, TextInput, FlatList, KeyboardAvoidingView } from 'react-native';
import * as Speech from 'expo-speech';
import * as Notifications from 'expo-notifications';
import { Audio } from 'expo-av';
import { iniciarBanco, adicionarMedicamento, listarMedicamentos, deletarMedicamento, Medicamento } from '../../database';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldPresentAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function HomeScreen() {
  const [chamadaVisivel, setChamadaVisivel] = useState(false);
  const [resumoRemedios, setResumoRemedios] = useState('');
  const somChamada = useRef<Audio.Sound | null>(null);

  const [medicamentos, setMedicamentos] = useState<Medicamento[]>([]);
  const [nomeForm, setNomeForm] = useState('');
  const [dosagemForm, setDosagemForm] = useState('');

  useEffect(() => {
    iniciarBanco();
    carregarLista();

    async function configurarApp() {
      await Notifications.requestPermissionsAsync();
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('lembretes', {
          name: 'lembretes',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 500, 250, 500],
          lightColor: '#FF0000',
        });
      }
    }
    configurarApp();

    const listenerClique = Notifications.addNotificationResponseReceivedListener(response => {
      const titulo = response.notification.request.content.title;
      if (titulo === "chamada medalo") {
        const remediosCadastrados = response.notification.request.content.data.remedios as string;
        dispararTelaChamada(remediosCadastrados);
      }
    });

    const listenerAberto = Notifications.addNotificationReceivedListener(notification => {
      const titulo = notification.request.content.title;
      if (titulo === "chamada medalo") {
        const remediosCadastrados = notification.request.content.data.remedios as string;
        dispararTelaChamada(remediosCadastrados);
      }
    });

    return () => {
      listenerClique.remove();
      listenerAberto.remove();
    };
  }, []);

  const carregarLista = () => {
    const dados = listarMedicamentos();
    setMedicamentos(dados);
  };

  const salvarRemedio = () => {
    if (!nomeForm || !dosagemForm) {
      Alert.alert('erro', 'preencha todos os campos');
      return;
    }

    adicionarMedicamento(nomeForm, dosagemForm);
    setNomeForm(''); 
    setDosagemForm('');
    carregarLista();
    Alert.alert('sucesso', 'remedio adicionado a lista');
  };

  const removerRemedio = (id: number) => {
    deletarMedicamento(id);
    carregarLista();
  };

  const simularCicloRemedio = async () => {
    if (medicamentos.length === 0) {
      Alert.alert('aviso', 'cadastre algo primeiro'); return;
    }
    
    const textoVoz = medicamentos.map(m => `${m.nome} ${m.dosagem}`).join(' e ');

    Alert.alert('iniciado', 'notificacao em 5s e chamada em 15s');

    await Notifications.scheduleNotificationAsync({
      content: { title: "hora do remedio", body: "toque para confirmar", sound: true, data: { remedios: textoVoz } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5, channelId: 'lembretes' },
    });

    await Notifications.scheduleNotificationAsync({
      content: { title: "chamada medalo", body: "alerta nao respondido toque para atender", sound: true, data: { remedios: textoVoz } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 15, channelId: 'lembretes' },
    });
  };

  const dispararTelaChamada = async (textoAgrupado: string) => {
    setChamadaVisivel(true);
    setResumoRemedios(textoAgrupado || "seus remedios");
    
    const { sound } = await Audio.Sound.createAsync(
      { uri: 'https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg' }, { isLooping: true }
    );
    somChamada.current = sound;
    await sound.playAsync();
    Vibration.vibrate([1000, 1000], true);

    Speech.speak(`alo! esta na hora de tomar: ${textoAgrupado}`, { language: 'pt-BR', rate: 0.9 });
  };

  const atenderChamada = async () => {
    Speech.stop(); Vibration.cancel();
    if (somChamada.current) { await somChamada.current.stopAsync(); await somChamada.current.unloadAsync(); }
    await Notifications.cancelAllScheduledNotificationsAsync();
    setChamadaVisivel(false);
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      
      <View style={styles.header}>
        <Text style={styles.tituloApp}>medalo</Text>
        <Text style={styles.subtituloApp}>prototipo de teste</Text>
      </View>

      <View style={styles.cardCadastro}>
        <Text style={styles.tituloSecao}>cadastrar remedio</Text>
        <TextInput style={styles.input} placeholder="nome (ex: losartana)" placeholderTextColor="#888" value={nomeForm} onChangeText={setNomeForm} />
        <TextInput style={styles.input} placeholder="dosagem (ex: 50mg)" placeholderTextColor="#888" value={dosagemForm} onChangeText={setDosagemForm} />
        
        <TouchableOpacity style={styles.botaoSalvar} onPress={salvarRemedio}>
          <Text style={styles.textoBotaoSalvar}>salvar na lista</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.tituloSecaoLista}>seus remedios</Text>
      <FlatList
        data={medicamentos}
        keyExtractor={(item) => item.id.toString()}
        style={styles.lista}
        renderItem={({ item }) => (
          <View style={styles.itemLista}>
            <View>
              <Text style={styles.itemNome}>{item.nome}</Text>
              <Text style={styles.itemDetalhes}>{item.dosagem}</Text>
            </View>
            <TouchableOpacity style={styles.botaoDeletar} onPress={() => removerRemedio(item.id)}>
              <Text style={styles.textoBotaoDeletar}>excluir</Text>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.listaVazia}>nenhum registro encontrado</Text>}
      />

      <View style={styles.areaBotoesAcao}>
        <TouchableOpacity style={styles.botaoIniciar} onPress={simularCicloRemedio}>
          <Text style={styles.textoBotaoAcao}>simular alarme</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={chamadaVisivel} animationType="slide" presentationStyle="fullScreen">
        <View style={styles.chamadaContainer}>
          <Text style={styles.chamadaTitulo}>atencao</Text>
          <Text style={styles.chamadaSubtitulo}>hora do remedio</Text>
          <Text style={styles.chamadaRemedio} numberOfLines={3}>{resumoRemedios}</Text>
          
          <TouchableOpacity style={styles.botaoAtender} onPress={atenderChamada}>
            <Text style={styles.textoBotaoAtender}>confirmar</Text>
          </TouchableOpacity>
        </View>
      </Modal>

    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#F5F5F5',
    padding: 20, 
    paddingTop: 50 
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  tituloApp: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333333',
  },
  subtituloApp: {
    fontSize: 14,
    color: '#666666',
  },
  cardCadastro: { 
    backgroundColor: '#FFFFFF', 
    padding: 15, 
    borderWidth: 1,
    borderColor: '#DDDDDD',
    marginBottom: 20 
  },
  tituloSecao: { 
    color: '#333333', 
    fontSize: 18, 
    fontWeight: 'bold', 
    marginBottom: 15 
  },
  tituloSecaoLista: {
    color: '#333333', 
    fontSize: 18, 
    fontWeight: 'bold', 
    marginBottom: 10 
  },
  input: { 
    backgroundColor: '#FFFFFF', 
    color: '#000000', 
    padding: 12, 
    borderWidth: 1,
    borderColor: '#CCCCCC',
    marginBottom: 10, 
    fontSize: 16 
  },
  botaoSalvar: { 
    backgroundColor: '#0056B3',
    padding: 15, 
    alignItems: 'center',
    marginTop: 5
  },
  textoBotaoSalvar: { 
    color: '#FFFFFF', 
    fontWeight: 'bold', 
    fontSize: 16 
  },
  lista: { 
    flex: 1, 
    marginBottom: 10 
  },
  itemLista: { 
    backgroundColor: '#FFFFFF', 
    padding: 15, 
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center' 
  },
  itemNome: { 
    color: '#000000', 
    fontSize: 18, 
    fontWeight: 'bold' 
  },
  itemDetalhes: { 
    color: '#555555', 
    fontSize: 14,
    marginTop: 4
  },
  botaoDeletar: { 
    backgroundColor: '#DC3545',
    paddingVertical: 8, 
    paddingHorizontal: 12, 
  },
  textoBotaoDeletar: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 12
  },
  listaVazia: { 
    color: '#888888', 
    textAlign: 'center', 
    marginTop: 20,
    fontSize: 16
  },
  areaBotoesAcao: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#DDDDDD',
    paddingTop: 15
  },
  botaoIniciar: { 
    backgroundColor: '#6C757D',
    padding: 15, 
    alignItems: 'center', 
  },
  textoBotaoAcao: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16
  },
  chamadaContainer: { 
    flex: 1, 
    backgroundColor: '#CC0000', 
    alignItems: 'center', 
    justifyContent: 'center', 
    padding: 20 
  },
  chamadaTitulo: { 
    fontSize: 36, 
    fontWeight: 'bold', 
    color: '#FFFFFF', 
    marginBottom: 5 
  },
  chamadaSubtitulo: {
    fontSize: 24,
    color: '#FFFFFF',
    marginBottom: 30
  },
  chamadaRemedio: { 
    fontSize: 28, 
    fontWeight: 'bold', 
    color: '#FFFFFF', 
    marginBottom: 60, 
    textAlign: 'center' 
  },
  botaoAtender: { 
    backgroundColor: '#FFFFFF', 
    width: '100%', 
    paddingVertical: 25, 
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#000000'
  },
  textoBotaoAtender: { 
    fontSize: 28, 
    fontWeight: 'bold', 
    color: '#000000' 
  },
});